/**
 * Share API for short project links, mounted into the `shotluma-app` Worker
 * entry (`scripts/shotluma-worker.ts`); `run_worker_first` routes only
 * `/api/share*` and `/s/*` through the Worker script for it.
 *
 * The API stores opaque, client-compressed share payloads in KV and hands
 * back a short id. It never inspects project content — decoding, validation,
 * and sanitization all stay in the browser (`src/app/share-link.ts`), and the
 * editor falls back to self-contained `#share=` links when this API is
 * unreachable. Alongside the payload the client may upload a rendered
 * Open Graph preview and the project name; `/s/<id>` serves the editor's
 * index.html with per-share OG tags injected so pasted links unfurl with the
 * project's own artwork.
 */

type ShareKv = {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  get(key: string, type: 'text'): Promise<string | null>
  put(key: string, value: ArrayBuffer | string, options?: { expirationTtl?: number }): Promise<void>
}

type RateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type ShareApiEnv = {
  SHARE_KV: ShareKv
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Optional Workers rate-limiting binding; writes are allowed when absent. */
  SHARE_RATE?: RateLimiter
}

/** Must stay at or below the client cap so accepted uploads always fit KV. */
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024
const MAX_TITLE_LENGTH = 120
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/
const SHARE_API_PATH = '/api/share'
const SHARE_PAGE_PREFIX = '/s/'

const previewKey = (id: string) => `preview:${id}`
const metaKey = (id: string) => `meta:${id}`

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const methodNotAllowed = (allow: string): Response =>
  new Response('Method not allowed', { status: 405, headers: { allow } })

const invalidShareId = (): Response => jsonResponse({ error: 'The share id is invalid.' }, 400)

const createShareId = (): string => {
  // 9 random bytes → 12 base64url characters, no padding.
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_')
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')

/** Rejects oversized uploads before buffering the body. */
const declaredLengthExceeds = (request: Request, maxBytes: number): boolean => {
  const declared = Number(request.headers.get('content-length') ?? '0')
  return Number.isFinite(declared) && declared > maxBytes
}

/**
 * Best-effort write throttle per client IP. The binding is optional so a
 * deployment without it stays functional.
 */
const writeAllowed = async (request: Request, env: ShareApiEnv): Promise<boolean> => {
  if (!env.SHARE_RATE) return true
  const key = request.headers.get('cf-connecting-ip') ?? 'unknown'
  try {
    return (await env.SHARE_RATE.limit({ key })).success
  } catch {
    return true
  }
}

const rateLimited = (): Response =>
  jsonResponse({ error: 'Too many shares — try again in a minute.' }, 429)

const storeShare = async (request: Request, env: ShareApiEnv): Promise<Response> => {
  if (declaredLengthExceeds(request, MAX_PAYLOAD_BYTES)) {
    return jsonResponse({ error: 'The share payload is too large.' }, 413)
  }
  if (!await writeAllowed(request, env)) return rateLimited()
  const payload = await request.arrayBuffer()
  if (payload.byteLength === 0) return jsonResponse({ error: 'The share payload is empty.' }, 400)
  if (payload.byteLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: 'The share payload is too large.' }, 413)
  }
  const id = createShareId()
  await env.SHARE_KV.put(id, payload, { expirationTtl: SHARE_TTL_SECONDS })
  return jsonResponse({ id })
}

const storeSharePreview = async (id: string, request: Request, env: ShareApiEnv): Promise<Response> => {
  if (declaredLengthExceeds(request, MAX_PREVIEW_BYTES)) {
    return jsonResponse({ error: 'The share preview is too large.' }, 413)
  }
  if (!await writeAllowed(request, env)) return rateLimited()
  const existing = await env.SHARE_KV.get(id, 'arrayBuffer')
  if (!existing) return jsonResponse({ error: 'This share link has expired or does not exist.' }, 404)

  const title = (new URL(request.url).searchParams.get('title') ?? '').trim().slice(0, MAX_TITLE_LENGTH)
  const preview = await request.arrayBuffer()
  if (preview.byteLength > MAX_PREVIEW_BYTES) {
    return jsonResponse({ error: 'The share preview is too large.' }, 413)
  }
  if (preview.byteLength > 0) {
    await env.SHARE_KV.put(previewKey(id), preview, { expirationTtl: SHARE_TTL_SECONDS })
  }
  await env.SHARE_KV.put(metaKey(id), JSON.stringify({ title }), { expirationTtl: SHARE_TTL_SECONDS })
  return jsonResponse({ ok: true })
}

const readShare = async (id: string, env: ShareApiEnv): Promise<Response> => {
  const payload = await env.SHARE_KV.get(id, 'arrayBuffer')
  if (!payload) return jsonResponse({ error: 'This share link has expired or does not exist.' }, 404)
  return new Response(payload, {
    headers: {
      'content-type': 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}

const readSharePreview = async (id: string, env: ShareApiEnv): Promise<Response> => {
  const preview = await env.SHARE_KV.get(previewKey(id), 'arrayBuffer')
  if (!preview) return new Response('Not found', { status: 404 })
  return new Response(preview, {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}

const readShareTitle = async (id: string, env: ShareApiEnv): Promise<string> => {
  try {
    const meta = await env.SHARE_KV.get(metaKey(id), 'text')
    if (!meta) return ''
    const parsed = JSON.parse(meta) as { title?: unknown }
    return typeof parsed.title === 'string' ? parsed.title : ''
  } catch {
    return ''
  }
}

// index.html ships static og:/twitter: tags for the editor itself. Crawlers
// often honor the first tag they see, so the defaults must be removed before
// the per-share tags are injected.
const stripDefaultSocialTags = (html: string): string =>
  html.replace(/[ \t]*<meta (?:property="og:|name="twitter:)[^>]*>\n?/g, '')

/** Serves the editor with per-share OG tags so pasted links unfurl nicely. */
const sharePage = async (id: string, url: URL, env: ShareApiEnv): Promise<Response> => {
  const assetResponse = await env.ASSETS.fetch(new Request(new URL('/', url).toString()))
  if (!assetResponse.ok) return assetResponse
  const html = stripDefaultSocialTags(await assetResponse.text())
  const title = await readShareTitle(id, env)
  const pageTitle = escapeHtml(title === '' ? 'Shared Shotluma project' : `${title} — Shotluma`)
  const tags = [
    '<meta property="og:site_name" content="Shotluma">',
    `<meta property="og:title" content="${pageTitle}">`,
    '<meta property="og:description" content="App Store screens shared with Shotluma. Open the link to get your own editable copy.">',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${url.origin}${SHARE_PAGE_PREFIX}${id}">`,
    `<meta property="og:image" content="${url.origin}${SHARE_API_PATH}/${id}/preview">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n')
  return new Response(html.replace('</head>', `${tags}\n</head>`), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}

const routeShareApi = (segments: string[], request: Request, env: ShareApiEnv): Promise<Response> | Response => {
  const [id, action] = segments
  if (!id || !SHARE_ID_PATTERN.test(id)) return invalidShareId()
  if (action === undefined) {
    return request.method === 'GET' ? readShare(id, env) : methodNotAllowed('GET')
  }
  if (action === 'preview' && segments.length === 2) {
    if (request.method === 'GET') return readSharePreview(id, env)
    if (request.method === 'POST') return storeSharePreview(id, request, env)
    return methodNotAllowed('GET, POST')
  }
  return new Response('Not found', { status: 404 })
}

/**
 * Handles a share API or share page request; returns null for every other
 * request so the Worker entry can continue with its remaining routes.
 */
export const handleShareRequest = (
  request: Request,
  env: ShareApiEnv,
): Promise<Response> | Response | null => {
  const url = new URL(request.url)
  if (url.pathname === SHARE_API_PATH) {
    return request.method === 'POST' ? storeShare(request, env) : methodNotAllowed('POST')
  }
  if (url.pathname.startsWith(`${SHARE_API_PATH}/`)) {
    const segments = url.pathname.slice(SHARE_API_PATH.length + 1).split('/')
    return routeShareApi(segments, request, env)
  }
  if (url.pathname.startsWith(SHARE_PAGE_PREFIX)) {
    const id = url.pathname.slice(SHARE_PAGE_PREFIX.length)
    if (SHARE_ID_PATTERN.test(id) && request.method === 'GET') return sharePage(id, url, env)
    // Unknown /s/ paths behave like any other SPA route.
  }
  return null
}

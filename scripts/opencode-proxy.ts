export const OPENCODE_ZEN_UPSTREAM = 'https://opencode.ai/zen'
export const OPENCODE_GO_UPSTREAM = 'https://opencode.ai/zen/go'

const GO_PREFIX = '/api/opencode/go'
const ZEN_PREFIX = '/api/opencode/zen'

export const OPENCODE_FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'accept',
] as const

const joinUpstream = (origin: string, suffix: string): URL => {
  const base = `${origin.replace(/\/$/u, '')}/`
  const relative = suffix.replace(/^\//u, '')
  return new URL(relative, base)
}

/**
 * Map a same-origin OpenCode CORS-proxy path onto the Zen or Go upstream.
 * `/api/opencode/go` is matched before `/api/opencode/zen` so the prefixes
 * cannot overlap.
 */
export const rewriteOpencodeProxyUrl = (requestUrl: URL): URL | null => {
  const path = requestUrl.pathname
  const search = requestUrl.search
  if (path === GO_PREFIX || path.startsWith(`${GO_PREFIX}/`)) {
    const upstream = joinUpstream(OPENCODE_GO_UPSTREAM, path.slice(GO_PREFIX.length))
    upstream.search = search
    return upstream
  }
  if (path === ZEN_PREFIX || path.startsWith(`${ZEN_PREFIX}/`)) {
    const upstream = joinUpstream(OPENCODE_ZEN_UPSTREAM, path.slice(ZEN_PREFIX.length))
    upstream.search = search
    return upstream
  }
  return null
}

export const copyOpencodeProxyHeaders = (source: Headers): Headers => {
  const headers = new Headers()
  for (const name of OPENCODE_FORWARDED_HEADERS) {
    const value = source.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

export const isOpencodeProxyMethod = (method: string): boolean => {
  const normalized = method.toUpperCase()
  return normalized === 'GET' || normalized === 'POST' || normalized === 'OPTIONS'
}

export const proxyOpencodeRequest = async (request: Request): Promise<Response> => {
  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (!isOpencodeProxyMethod(request.method)) {
    return new Response('Method not allowed', { status: 405 })
  }
  const upstream = rewriteOpencodeProxyUrl(new URL(request.url))
  if (!upstream) {
    return new Response('Not found', { status: 404 })
  }
  const method = request.method.toUpperCase()
  // Node's fetch types require `duplex` when forwarding a stream body.
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: copyOpencodeProxyHeaders(request.headers),
    redirect: 'manual',
  }
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }
  return fetch(upstream, init)
}

import { collectAssetSources, mapAssetSources } from '../asset-sources'
import { hydrateProjectAssets } from '../asset-store'
import { sanitizeScreenHtml } from '../html-slide/sanitize'
import { fileToDataUrl, sanitizeRichText } from '../utils'
import type { Background, CanvasElement, Slide, UploadAsset } from '../types'

/**
 * Project share links. The share payload is the project as deflate-raw
 * compressed JSON — screens, uploads, and every image inlined as a data URL —
 * so a link always transfers a complete, independent copy. Two link forms
 * exist:
 *
 * - `/s/<id>` (preferred): the payload is stored by the share API
 *   (`worker/share-worker.ts`, Cloudflare KV, 90-day retention) and the link
 *   stays short. The id lives in the path — not the fragment — so the Worker
 *   can serve per-share Open Graph tags to link-preview crawlers; the app
 *   itself consumes the id on boot and rewrites the URL back to `/`. A
 *   rendered preview image and the project name are uploaded best-effort for
 *   that unfurl. `#s=<id>` stays readable for compatibility.
 * - `#share=<base64url payload>` (fallback): when the share API is
 *   unreachable, the link carries the payload itself and can get very long,
 *   but sharing keeps working without any server.
 *
 * Opening either link imports an independent copy into the recipient's local
 * workspace; their edits and deletions stay on their device and never affect
 * the sender's project.
 *
 * A share payload is untrusted input: a link can be handcrafted, so decoding
 * re-sanitizes AI screen markup and rich text and drops unsafe image sources
 * before anything reaches the editor.
 */

export type SharedProjectPayload = {
  projectName: string
  slides: Slide[]
  uploads: UploadAsset[]
}

export const SHARE_HASH_PREFIX = '#share='
export const SHORT_SHARE_HASH_PREFIX = '#s='
export const SHORT_SHARE_PATH_PREFIX = '/s/'

const SHARE_API_PATH = '/api/share'
const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{6,32}$/
const SHARE_FORMAT_VERSION = 1

// A stalled share API request must degrade to the inline fallback (or a
// failed import) instead of leaving the dialog on "Preparing link …" forever.
const SHARE_API_TIMEOUT_MS = 15_000

// Ceiling for the decompressed payload so a handcrafted link cannot act as a
// decompression bomb against the importing tab.
const MAX_DECODED_BYTES = 64 * 1024 * 1024

/** Links longer than this are likely to be truncated by messengers. */
export const SHARE_LINK_LENGTH_WARNING = 30_000

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const base64UrlToBytes = (encoded: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

// jsdom's Blob lacks stream(), so the pipelines start from a plain
// ReadableStream over the raw bytes instead. BufferSource chunks match the
// writable side of Compression/DecompressionStream.
const bytesToStream = (bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

const compressText = async (text: string): Promise<Uint8Array<ArrayBuffer>> => {
  const stream = bytesToStream(new TextEncoder().encode(text)).pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const decompressBytes = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const stream = bytesToStream(bytes).pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let decodedBytes = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    decodedBytes += value.byteLength
    if (decodedBytes > MAX_DECODED_BYTES) {
      void reader.cancel()
      throw new Error('The share payload is too large.')
    }
    text += decoder.decode(value, { stream: true })
  }
}

// Images dominate link length, so shared copies are capped at export
// resolution and re-encoded as WebP. The smaller encoding wins; failures fall
// back to the original bytes.
const MAX_SHARED_IMAGE_DIMENSION = 2796
const SHARED_IMAGE_WEBP_QUALITY = 0.85

const reencodeImageBlob = async (blob: Blob): Promise<Blob> => {
  if (blob.type === 'image/svg+xml') return blob
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_SHARED_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return blob
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const encoded = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', SHARED_IMAGE_WEBP_QUALITY)
    })
    return encoded && encoded.size < blob.size ? encoded : blob
  } catch {
    return blob
  }
}

/**
 * Replaces session-local object URLs with inlined data URLs so the link is
 * meaningful on another device. Sources that cannot be read keep their URL and
 * degrade to a missing image instead of failing the whole share.
 */
const inlineImageSources = async (project: SharedProjectPayload): Promise<SharedProjectPayload> => {
  const hydrated = await hydrateProjectAssets(project)
  const replacements = new Map<string, string>()
  for (const src of collectAssetSources(hydrated)) {
    if (!src.startsWith('blob:')) continue
    try {
      const blob = await (await fetch(src)).blob()
      replacements.set(src, await fileToDataUrl(await reencodeImageBlob(blob)))
    } catch {
      // Keep the source as-is; see above.
    }
  }
  return mapAssetSources(hydrated, (src) => replacements.get(src) ?? src)
}

export type ShareLinkResult = {
  url: string
  /** 'short' when the payload is stored by the share API; 'inline' when the URL carries it. */
  mode: 'short' | 'inline'
}

const requestShortShareId = async (payload: Uint8Array<ArrayBuffer>): Promise<string | null> => {
  try {
    const response = await fetch(SHARE_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: payload,
      signal: AbortSignal.timeout(SHARE_API_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const result = (await response.json()) as { id?: unknown }
    return typeof result.id === 'string' && SHARE_ID_PATTERN.test(result.id) ? result.id : null
  } catch {
    return null
  }
}

/**
 * Uploads the unfurl artwork and title for a stored share. Best-effort: the
 * link works without it, it just unfurls generically.
 */
const uploadSharePreview = async (id: string, title: string, preview: Blob | null): Promise<void> => {
  try {
    await fetch(`${SHARE_API_PATH}/${id}/preview?title=${encodeURIComponent(title)}`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: preview ?? new Blob([]),
      signal: AbortSignal.timeout(SHARE_API_TIMEOUT_MS),
    })
  } catch {
    // See above.
  }
}

export type ShareLinkOptions = {
  /** Renders the Open Graph preview image; only invoked for short links. */
  createPreview?: () => Promise<Blob | null>
}

export const createShareLink = async (
  project: SharedProjectPayload,
  options: ShareLinkOptions = {},
): Promise<ShareLinkResult> => {
  const inlined = await inlineImageSources(project)
  const json = JSON.stringify({
    v: SHARE_FORMAT_VERSION,
    projectName: inlined.projectName,
    slides: inlined.slides,
    uploads: inlined.uploads,
  })
  const compressed = await compressText(json)
  const { origin, pathname } = window.location

  const id = await requestShortShareId(compressed)
  if (id) {
    const preview = options.createPreview ? await options.createPreview().catch(() => null) : null
    await uploadSharePreview(id, project.projectName, preview)
    return { url: `${origin}${SHORT_SHARE_PATH_PREFIX}${id}`, mode: 'short' }
  }
  return { url: `${origin}${pathname}${SHARE_HASH_PREFIX}${bytesToBase64Url(compressed)}`, mode: 'inline' }
}

// Sources render through <img> and CSS backgrounds only, but a handcrafted
// payload gets no chance to smuggle in exotic schemes regardless.
const isSafeImageSource = (src: string): boolean =>
  src.startsWith('data:image/')
  || src.startsWith('https://')
  || src.startsWith('http://')
  || src.startsWith('blob-asset:')
  || !src.includes(':')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeSharedElement = (value: unknown): CanvasElement | null => {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['type'] !== 'string') return null
  const element = value as unknown as CanvasElement
  if (element.type === 'text' && typeof element.html === 'string') {
    return { ...element, html: sanitizeRichText(element.html) }
  }
  return element
}

const normalizeSharedSlide = (value: unknown): Slide | null => {
  if (!isRecord(value)) return null
  if (typeof value['id'] !== 'string' || typeof value['name'] !== 'string') return null
  if (!isRecord(value['background']) || !Array.isArray(value['elements'])) return null

  const slide: Slide = {
    id: value['id'],
    name: value['name'],
    background: value['background'] as unknown as Background,
    elements: value['elements']
      .map(normalizeSharedElement)
      .filter((element): element is CanvasElement => element !== null),
  }
  if (typeof value['html'] === 'string') slide.html = sanitizeScreenHtml(value['html']).html
  return slide
}

const normalizeSharedUpload = (value: unknown): UploadAsset | null => {
  if (!isRecord(value)) return null
  if (typeof value['id'] !== 'string' || typeof value['name'] !== 'string' || typeof value['src'] !== 'string') return null
  return { id: value['id'], name: value['name'], src: value['src'] }
}

const normalizeSharedProject = (value: unknown): SharedProjectPayload | null => {
  if (!isRecord(value) || value['v'] !== SHARE_FORMAT_VERSION) return null
  if (!Array.isArray(value['slides'])) return null

  const project: SharedProjectPayload = {
    projectName: typeof value['projectName'] === 'string' && value['projectName'].trim() !== ''
      ? value['projectName']
      : 'Shared project',
    slides: value['slides']
      .map(normalizeSharedSlide)
      .filter((slide): slide is Slide => slide !== null),
    uploads: (Array.isArray(value['uploads']) ? value['uploads'] : [])
      .map(normalizeSharedUpload)
      .filter((upload): upload is UploadAsset => upload !== null),
  }
  return mapAssetSources(project, (src) => (isSafeImageSource(src) ? src : ''))
}

const fetchStoredPayloadBytes = async (id: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!SHARE_ID_PATTERN.test(id)) return null
  const response = await fetch(`${SHARE_API_PATH}/${id}`, {
    signal: AbortSignal.timeout(SHARE_API_TIMEOUT_MS),
  })
  if (!response.ok) return null
  return new Uint8Array(await response.arrayBuffer())
}

const sharePayloadBytes = async (hash: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (hash.startsWith(SHORT_SHARE_HASH_PREFIX)) {
    return fetchStoredPayloadBytes(hash.slice(SHORT_SHARE_HASH_PREFIX.length))
  }
  if (hash.startsWith(SHARE_HASH_PREFIX)) {
    return base64UrlToBytes(hash.slice(SHARE_HASH_PREFIX.length))
  }
  return null
}

/** Decodes and validates a `#s=` or `#share=` fragment; null when it cannot be trusted. */
export const decodeSharePayload = async (hash: string): Promise<SharedProjectPayload | null> => {
  try {
    const bytes = await sharePayloadBytes(hash)
    if (!bytes) return null
    const parsed: unknown = JSON.parse(await decompressBytes(bytes))
    return normalizeSharedProject(parsed)
  } catch {
    return null
  }
}

const isShareHash = (hash: string) =>
  hash.startsWith(SHARE_HASH_PREFIX) || hash.startsWith(SHORT_SHARE_HASH_PREFIX)

/**
 * Reads and clears a pending share fragment or `/s/<id>` path so a reload
 * does not re-import the project. Returns a hash for {@link decodeSharePayload}.
 */
export const consumeShareLinkHash = (): string | null => {
  const { hash, pathname, search } = window.location
  if (isShareHash(hash)) {
    history.replaceState(null, '', `${pathname}${search}`)
    return hash
  }
  if (pathname.startsWith(SHORT_SHARE_PATH_PREFIX)) {
    const id = pathname.slice(SHORT_SHARE_PATH_PREFIX.length)
    if (SHARE_ID_PATTERN.test(id)) {
      history.replaceState(null, '', `/${search}`)
      return `${SHORT_SHARE_HASH_PREFIX}${id}`
    }
  }
  return null
}

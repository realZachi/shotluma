import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeShareLinkHash,
  createShareLink,
  decodeSharePayload,
  SHARE_HASH_PREFIX,
  SHORT_SHARE_HASH_PREFIX,
  SHORT_SHARE_PATH_PREFIX,
  type SharedProjectPayload,
} from './share-link'
import type { Slide, TextElement } from '../types'

const makeSlide = (overrides: Partial<Slide> = {}): Slide => ({
  id: 'slide-1',
  name: 'Hero',
  background: { type: 'solid', color1: '#111111', color2: '#222222', angle: 45 },
  elements: [],
  ...overrides,
})

const makeTextElement = (overrides: Partial<TextElement> = {}): TextElement => ({
  id: 'element-1',
  type: 'text',
  x: 10,
  y: 12,
  width: 60,
  rotation: 0,
  opacity: 1,
  text: 'Hello',
  color: '#ffffff',
  fontFamily: 'Geist',
  fontSize: 32,
  fontWeight: 700,
  align: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  ...overrides,
})

const makeProject = (overrides: Partial<SharedProjectPayload> = {}): SharedProjectPayload => ({
  projectName: 'Summer Launch',
  slides: [makeSlide({ elements: [makeTextElement()] })],
  uploads: [],
  ...overrides,
})

const hashOf = (link: string) => link.slice(link.indexOf('#'))

/** Builds an inline fallback link (the share API is stubbed offline). */
const inlineShareHash = async (project: SharedProjectPayload) =>
  hashOf((await createShareLink(project)).url)

const compressJson = async (value: unknown): Promise<Uint8Array<ArrayBuffer>> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const stream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  }).pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// Handcrafts a `#share=` fragment the way an attacker could, bypassing
// createShareLink's well-formed input assumptions.
const craftShareHash = async (value: unknown) => {
  const compressed = await compressJson(value)
  const base64 = btoa(String.fromCharCode(...compressed))
  return `${SHARE_HASH_PREFIX}${base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
}

describe('share links', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('share API offline'))))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to a self-contained link when the share API is unreachable', async () => {
    const project = makeProject({
      uploads: [{ id: 'upload-1', name: 'shot.png', src: 'data:image/png;base64,aGk=' }],
    })

    const result = await createShareLink(project)
    expect(result.mode).toBe('inline')
    expect(result.url).toContain(SHARE_HASH_PREFIX)

    const decoded = await decodeSharePayload(hashOf(result.url))
    expect(decoded).toEqual(project)
  })

  it('creates a short /s/ link and uploads the unfurl preview', async () => {
    const upload = vi.fn((input: unknown) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(input === '/api/share' ? { id: 'abcDEF123456' } : { ok: true }),
    }))
    vi.stubGlobal('fetch', upload)

    const result = await createShareLink(makeProject(), {
      createPreview: () => Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })),
    })
    expect(result.mode).toBe('short')
    expect(result.url).toBe(`${window.location.origin}${SHORT_SHARE_PATH_PREFIX}abcDEF123456`)
    expect(upload).toHaveBeenCalledWith('/api/share', expect.objectContaining({ method: 'POST' }))
    expect(upload).toHaveBeenCalledWith(
      '/api/share/abcDEF123456/preview?title=Summer%20Launch',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('creates the short link even when rendering the preview fails', async () => {
    const upload = vi.fn((input: unknown) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(input === '/api/share' ? { id: 'abcDEF123456' } : { ok: true }),
    }))
    vi.stubGlobal('fetch', upload)

    const result = await createShareLink(makeProject(), {
      createPreview: () => Promise.reject(new Error('no canvas')),
    })
    expect(result.mode).toBe('short')
  })

  it('falls back to a self-contained link when the API answers with something else', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ unexpected: true }),
    })))

    const result = await createShareLink(makeProject())
    expect(result.mode).toBe('inline')
  })

  it('decodes a short link by downloading the stored payload', async () => {
    const project = makeProject()
    const payload = await compressJson({ v: 1, ...project })
    const download = vi.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(payload.buffer),
    }))
    vi.stubGlobal('fetch', download)

    const decoded = await decodeSharePayload(`${SHORT_SHARE_HASH_PREFIX}abcDEF123456`)
    expect(decoded).toEqual(project)
    expect(download).toHaveBeenCalledWith(
      '/api/share/abcDEF123456',
      expect.objectContaining({ signal: expect.any(AbortSignal) as unknown }),
    )
  })

  it('rejects malformed short ids without calling the API', async () => {
    const download = vi.fn()
    vi.stubGlobal('fetch', download)

    expect(await decodeSharePayload(`${SHORT_SHARE_HASH_PREFIX}../evil`)).toBeNull()
    expect(await decodeSharePayload(`${SHORT_SHARE_HASH_PREFIX}ab`)).toBeNull()
    expect(download).not.toHaveBeenCalled()
  })

  it('returns null when the stored payload is missing or expired', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })))

    expect(await decodeSharePayload(`${SHORT_SHARE_HASH_PREFIX}abcDEF123456`)).toBeNull()
  })

  it('keeps inline data URL image sources intact for the recipient', async () => {
    const slide = makeSlide({
      background: {
        type: 'image',
        color1: '#111111',
        color2: '#222222',
        angle: 0,
        image: 'data:image/png;base64,aGk=',
      },
    })

    const decoded = await decodeSharePayload(await inlineShareHash(makeProject({ slides: [slide] })))
    expect(decoded?.slides[0]?.background.image).toBe('data:image/png;base64,aGk=')
  })

  it('sanitizes AI screen markup carried by a link', async () => {
    const slide = makeSlide({ html: '<div>Safe</div><script>alert(1)</script>' })

    const decoded = await decodeSharePayload(await inlineShareHash(makeProject({ slides: [slide] })))
    expect(decoded?.slides[0]?.html).toContain('Safe')
    expect(decoded?.slides[0]?.html).not.toContain('script')
  })

  it('sanitizes rich text markup on text elements', async () => {
    const element = makeTextElement({ html: 'Hi <img src="x" onerror="alert(1)"> there' })

    const decoded = await decodeSharePayload(
      await inlineShareHash(makeProject({ slides: [makeSlide({ elements: [element] })] })),
    )
    const decodedElement = decoded?.slides[0]?.elements[0]
    expect(decodedElement?.type).toBe('text')
    expect((decodedElement as TextElement).html).not.toContain('onerror')
    expect((decodedElement as TextElement).html).not.toContain('img')
  })

  it('drops unsafe image source schemes from a handcrafted payload', async () => {
    const slide = makeSlide({
      elements: [{
        id: 'element-2',
        type: 'image',
        x: 0,
        y: 0,
        width: 50,
        rotation: 0,
        opacity: 1,
        src: 'javascript:alert(1)',
        borderRadius: 0,
      }],
    })

    const decoded = await decodeSharePayload(await inlineShareHash(makeProject({ slides: [slide] })))
    const decodedElement = decoded?.slides[0]?.elements[0]
    expect(decodedElement?.type).toBe('image')
    expect(decodedElement && 'src' in decodedElement ? decodedElement.src : null).toBe('')
  })

  it('drops malformed slides, elements, and uploads instead of importing them', async () => {
    const hash = await craftShareHash({
      v: 1,
      projectName: 'Mixed bag',
      slides: [makeSlide(), { id: 42 }, 'nonsense'],
      uploads: [{ id: 'upload-1', name: 'ok.png', src: 'data:image/png;base64,aGk=' }, { id: 7 }],
    })

    const decoded = await decodeSharePayload(hash)
    expect(decoded?.slides).toHaveLength(1)
    expect(decoded?.uploads).toHaveLength(1)
  })

  it('supports projects with zero slides', async () => {
    const decoded = await decodeSharePayload(await inlineShareHash(makeProject({ slides: [] })))
    expect(decoded?.slides).toEqual([])
  })

  it('rejects payloads that are not valid share links', async () => {
    expect(await decodeSharePayload('#other=abc')).toBeNull()
    expect(await decodeSharePayload(`${SHARE_HASH_PREFIX}not-real-base64!!!`)).toBeNull()
    expect(await decodeSharePayload(`${SHARE_HASH_PREFIX}${btoa('plain json')}`)).toBeNull()
  })

  it('rejects a payload with an unknown format version', async () => {
    expect(await decodeSharePayload(await craftShareHash({ v: 99, slides: [] }))).toBeNull()
  })

  it('consumes short and inline share fragments exactly once', () => {
    window.location.hash = `${SHARE_HASH_PREFIX}payload`
    expect(consumeShareLinkHash()).toBe(`${SHARE_HASH_PREFIX}payload`)
    expect(window.location.hash).toBe('')
    expect(consumeShareLinkHash()).toBeNull()

    window.location.hash = `${SHORT_SHARE_HASH_PREFIX}abcDEF123456`
    expect(consumeShareLinkHash()).toBe(`${SHORT_SHARE_HASH_PREFIX}abcDEF123456`)
    expect(window.location.hash).toBe('')
  })

  it('consumes a /s/<id> share path and rewrites the URL back to the root', () => {
    history.replaceState(null, '', `${SHORT_SHARE_PATH_PREFIX}abcDEF123456`)

    expect(consumeShareLinkHash()).toBe(`${SHORT_SHARE_HASH_PREFIX}abcDEF123456`)
    expect(window.location.pathname).toBe('/')
    expect(consumeShareLinkHash()).toBeNull()
  })

  it('leaves /s/ paths that are not share ids alone', () => {
    history.replaceState(null, '', `${SHORT_SHARE_PATH_PREFIX}ab`)

    expect(consumeShareLinkHash()).toBeNull()
    expect(window.location.pathname).toBe(`${SHORT_SHARE_PATH_PREFIX}ab`)
    history.replaceState(null, '', '/')
  })

  it('ignores unrelated fragments', () => {
    window.location.hash = '#section'

    expect(consumeShareLinkHash()).toBeNull()
    expect(window.location.hash).toBe('#section')
    window.location.hash = ''
  })
})

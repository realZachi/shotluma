import { describe, expect, it, vi } from 'vitest'
import { createAiController } from './controller'
import { createHtmlScreenTools, HTML_SCREEN_CHARACTER_LIMIT } from './html-tools'
import { createEditorTools } from './tools'
import type { ToolContext } from './tool-context'
import type { Slide, UploadAsset } from '../types'

type HtmlTools = ReturnType<typeof createHtmlScreenTools>
type ExecuteOptions = Parameters<HtmlTools['add_html_screen']['execute']>[1]

/** The AI SDK passes call metadata we do not exercise here. */
const EXECUTE_OPTIONS = { toolCallId: 'call-1', messages: [] } as unknown as ExecuteOptions

const createHarness = (initialSlides: Slide[] = []) => {
  let slides = initialSlides
  let uploads: UploadAsset[] = []
  const controller = createAiController({
    getSlides: () => slides,
    setSlides: (updater) => {
      slides = updater(slides)
    },
    getUploads: () => uploads,
    setUploads: (updater) => {
      uploads = updater(uploads)
    },
  })
  const emit = vi.fn()
  const context: ToolContext = { controller, emit }
  return {
    tools: createHtmlScreenTools(context),
    controller,
    emit,
    getSlides: () => slides,
  }
}

const htmlSlide = (id: string, html: string): Slide => ({
  id,
  name: 'Screen',
  background: { type: 'solid', color1: '#111116', color2: '#111116', angle: 90 },
  elements: [],
  html,
})

const structuredSlide = (id: string): Slide => ({
  id,
  name: 'Screen',
  background: { type: 'solid', color1: '#111116', color2: '#111116', angle: 90 },
  elements: [],
})

describe('add_html_screen', () => {
  it('creates an HTML slide holding the sanitized markup', async () => {
    const { tools, getSlides, emit } = createHarness()

    const result = await tools.add_html_screen.execute(
      { name: 'Hero', html: '<div class="hero">Big claim</div>' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: true })
    const slide = getSlides()[0]
    expect(slide?.name).toBe('Hero')
    expect(slide?.html).toBe('<div class="hero">Big claim</div>')
    expect(slide?.elements).toEqual([])
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ tool: 'add_html_screen' }))
  })

  it('strips disallowed markup before storing and reports it', async () => {
    const { tools, getSlides } = createHarness()

    const result = await tools.add_html_screen.execute(
      { html: '<div>ok</div><script>alert(1)</script>' },
      EXECUTE_OPTIONS,
    ) as { ok: boolean; sanitizerWarnings?: string[] }

    expect(result.ok).toBe(true)
    expect(result.sanitizerWarnings?.length).toBeGreaterThan(0)
    expect(getSlides()[0]?.html).not.toContain('script')
  })

  it('rejects oversized markup without creating a slide', async () => {
    const { tools, getSlides } = createHarness()

    const result = await tools.add_html_screen.execute(
      { html: 'x'.repeat(HTML_SCREEN_CHARACTER_LIMIT + 1) },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: false })
    expect(getSlides()).toHaveLength(0)
  })
})

describe('set_screen_html', () => {
  it('replaces the markup of an HTML slide', async () => {
    const { tools, getSlides } = createHarness([htmlSlide('slide-1', '<div>old</div>')])

    const result = await tools.set_screen_html.execute(
      { slideId: 'slide-1', html: '<div>new</div>' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: true })
    expect(getSlides()[0]?.html).toBe('<div>new</div>')
  })

  it('refuses to touch a structured element slide', async () => {
    const { tools, getSlides } = createHarness([structuredSlide('slide-1')])

    const result = await tools.set_screen_html.execute(
      { slideId: 'slide-1', html: '<div>new</div>' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: false })
    expect(getSlides()[0]?.html).toBeUndefined()
  })

  it('reports a missing slide as a structured failure', async () => {
    const { tools } = createHarness()

    const result = await tools.set_screen_html.execute(
      { slideId: 'missing', html: '<div>x</div>' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: false })
  })
})

describe('patch_screen_html', () => {
  it('replaces one unique occurrence', async () => {
    const { tools, getSlides } = createHarness([htmlSlide('slide-1', '<h1>Old headline</h1><p>body</p>')])

    const result = await tools.patch_screen_html.execute(
      { slideId: 'slide-1', find: 'Old headline', replace: 'New headline' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: true })
    expect(getSlides()[0]?.html).toBe('<h1>New headline</h1><p>body</p>')
  })

  it('fails without changes when the find text is missing', async () => {
    const { tools, getSlides } = createHarness([htmlSlide('slide-1', '<h1>Headline</h1>')])

    const result = await tools.patch_screen_html.execute(
      { slideId: 'slide-1', find: 'nope', replace: 'x' },
      EXECUTE_OPTIONS,
    )

    expect(result).toMatchObject({ ok: false })
    expect(getSlides()[0]?.html).toBe('<h1>Headline</h1>')
  })

  it('fails without changes when the find text is ambiguous', async () => {
    const { tools, getSlides } = createHarness([htmlSlide('slide-1', '<p>twice</p><p>twice</p>')])

    const result = await tools.patch_screen_html.execute(
      { slideId: 'slide-1', find: 'twice', replace: 'once' },
      EXECUTE_OPTIONS,
    ) as { ok: boolean; error?: string }

    expect(result.ok).toBe(false)
    expect(result.error).toContain('2 times')
    expect(getSlides()[0]?.html).toBe('<p>twice</p><p>twice</p>')
  })

  it('sanitizes markup introduced by the patch', async () => {
    const { tools, getSlides } = createHarness([htmlSlide('slide-1', '<div>PLACEHOLDER</div>')])

    const result = await tools.patch_screen_html.execute(
      { slideId: 'slide-1', find: 'PLACEHOLDER', replace: '<script>alert(1)</script>fine' },
      EXECUTE_OPTIONS,
    ) as { ok: boolean; sanitizerWarnings?: string[] }

    expect(result.ok).toBe(true)
    expect(result.sanitizerWarnings?.length).toBeGreaterThan(0)
    expect(getSlides()[0]?.html).toBe('<div>fine</div>')
  })
})

describe('createEditorTools html mode', () => {
  const controllerStub = {} as Parameters<typeof createEditorTools>[0]

  it('exposes the full HTML toolset in generate mode', () => {
    const tools = createEditorTools(controllerStub, { mode: 'generate', htmlScreens: true })

    expect(Object.keys(tools).sort()).toEqual([
      'add_html_screen',
      'declare_plan',
      'delete_slide',
      'get_canvas_state',
      'patch_screen_html',
      'rename_slide',
      'render_slide_preview',
      'set_screen_html',
    ])
  })

  it('restricts edit mode to revising the target screen', () => {
    const tools = createEditorTools(controllerStub, { mode: 'edit', htmlScreens: true })

    expect(Object.keys(tools).sort()).toEqual([
      'get_canvas_state',
      'patch_screen_html',
      'rename_slide',
      'render_slide_preview',
      'set_screen_html',
    ])
  })
})

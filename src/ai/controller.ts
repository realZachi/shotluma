import { uid } from '../utils'
import type { Background, CanvasElement, Slide, UploadAsset } from '../types'

export type ProjectSnapshot = {
  canvas: { width: 1290; height: 2796; coordinates: 'percent' }
  slides: {
    id: string
    name: string
    index: number
    kind: 'elements' | 'html'
    background: Record<string, unknown> // background data WITHOUT data URLs: image is replaced with imageAssetId or hasImage
    elements: Record<string, unknown>[] // element data WITHOUT data URLs: for device elements replace `screenshot` with `screenshotAssetId` (matched by comparing src against uploads) or hasScreenshot boolean; for image elements replace `src` with `assetId`
    html?: string // html screens only: the stored markup, which references uploads via asset: ids and never contains user data URLs
  }[]
  assets: { id: string; name: string }[]
}

export type AiEditorController = {
  snapshot(): ProjectSnapshot
  addSlide(input: { name?: string; background?: Background }): string // returns new slide id, appends at end
  addHtmlSlide(input: { name?: string; html: string }): string // returns new slide id, appends an AI-authored HTML screen
  renameSlide(slideId: string, name: string): boolean
  setSlideBackground(slideId: string, patch: Partial<Background>): boolean
  setSlideHtml(slideId: string, html: string): boolean // must refuse (return false) for structured element slides
  deleteSlide(slideId: string): boolean // must refuse (return false) if it would delete the last remaining slide
  addElement(slideId: string, element: Omit<CanvasElement, 'id'>): string | null // returns element id; refuses on html slides
  updateElement(slideId: string, elementId: string, patch: Record<string, unknown>): boolean
  deleteElement(slideId: string, elementId: string): boolean
  getAssetSrc(assetId: string): string | undefined
  /** Register a new upload asset (data URL) and return its id. */
  addAsset(input: { name: string; src: string }): string
}

const DEFAULT_NEW_SLIDE_BACKGROUND: Background = { type: 'solid', color1: '#111116', color2: '#111116', angle: 90 }

// Keys every element type may receive through `update_element`, plus keys specific to each type.
const BASE_UPDATE_KEYS = new Set(['x', 'y', 'width', 'rotation', 'opacity'])
const TYPE_UPDATE_KEYS: Record<CanvasElement['type'], Set<string>> = {
  text: new Set([
    'text', 'html', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'align', 'lineHeight', 'letterSpacing', 'italic',
    'underline', 'strikethrough', 'textTransform', 'backgroundColor', 'backgroundOpacity', 'padding', 'borderRadius',
    'strokeColor', 'strokeWidth', 'shadow', 'shadowColor',
  ]),
  device: new Set(['deviceStyle', 'screenshot', 'screenTheme', 'tiltX', 'tiltY', 'shadow', 'spansScreens']),
  image: new Set(['src', 'borderRadius', 'shadow']),
  shape: new Set(['shape', 'color', 'strokeColor', 'strokeWidth', 'shadow']),
  icon: new Set(['icon', 'color', 'strokeWidth', 'shadow']),
}

const findAssetIdBySrc = (src: string | undefined, uploads: UploadAsset[]): string | undefined => {
  if (!src) return undefined
  return uploads.find((asset) => asset.src === src)?.id
}

const serializeElement = (element: CanvasElement, uploads: UploadAsset[]): Record<string, unknown> => {
  // Text elements keep `html` in the snapshot so existing per-word styling is visible;
  // it is written only through the `highlights` tool input, never as raw HTML.
  if (element.type === 'device') {
    const { screenshot, ...rest } = element
    const screenshotAssetId = findAssetIdBySrc(screenshot, uploads)
    return {
      ...rest,
      ...(screenshotAssetId ? { screenshotAssetId } : {}),
      hasScreenshot: Boolean(screenshot),
    }
  }
  if (element.type === 'image') {
    const { src, ...rest } = element
    const assetId = findAssetIdBySrc(src, uploads)
    return {
      ...rest,
      ...(assetId ? { assetId } : {}),
      hasSrc: Boolean(src),
    }
  }
  return { ...element }
}

const serializeBackground = (background: Background, uploads: UploadAsset[]): Record<string, unknown> => {
  const { image, ...rest } = background
  const imageAssetId = findAssetIdBySrc(image, uploads)
  return {
    ...rest,
    ...(imageAssetId ? { imageAssetId } : {}),
    hasImage: Boolean(image),
  }
}

export function createAiController(io: {
  getSlides(): Slide[]
  setSlides(updater: (slides: Slide[]) => Slide[]): void
  getUploads(): UploadAsset[]
  setUploads(updater: (uploads: UploadAsset[]) => UploadAsset[]): void
}): AiEditorController {
  const findSlide = (slideId: string) => io.getSlides().find((slide) => slide.id === slideId)

  const snapshot: AiEditorController['snapshot'] = () => {
    const slides = io.getSlides()
    const uploads = io.getUploads()
    return {
      canvas: { width: 1290, height: 2796, coordinates: 'percent' },
      slides: slides.map((slide, index) => ({
        id: slide.id,
        name: slide.name,
        index,
        kind: slide.html !== undefined ? 'html' as const : 'elements' as const,
        background: serializeBackground(slide.background, uploads),
        elements: slide.elements.map((element) => serializeElement(element, uploads)),
        ...(slide.html !== undefined ? { html: slide.html } : {}),
      })),
      assets: uploads.map((asset) => ({ id: asset.id, name: asset.name })),
    }
  }

  const addSlide: AiEditorController['addSlide'] = ({ name, background }) => {
    const id = uid('slide')
    io.setSlides((current) => [
      ...current,
      {
        id,
        name: name ?? `Screen ${current.length + 1}`,
        background: background ?? DEFAULT_NEW_SLIDE_BACKGROUND,
        elements: [],
      },
    ])
    return id
  }

  const addHtmlSlide: AiEditorController['addHtmlSlide'] = ({ name, html }) => {
    const id = uid('slide')
    io.setSlides((current) => [
      ...current,
      {
        id,
        name: name ?? `Screen ${current.length + 1}`,
        background: DEFAULT_NEW_SLIDE_BACKGROUND,
        elements: [],
        html,
      },
    ])
    return id
  }

  const setSlideHtml: AiEditorController['setSlideHtml'] = (slideId, html) => {
    const slide = findSlide(slideId)
    if (slide?.html === undefined) return false
    io.setSlides((current) => current.map((candidate) => (candidate.id === slideId ? { ...candidate, html } : candidate)))
    return true
  }

  const renameSlide: AiEditorController['renameSlide'] = (slideId, name) => {
    if (!findSlide(slideId)) return false
    io.setSlides((current) => current.map((slide) => (slide.id === slideId ? { ...slide, name } : slide)))
    return true
  }

  const setSlideBackground: AiEditorController['setSlideBackground'] = (slideId, patch) => {
    if (!findSlide(slideId)) return false
    io.setSlides((current) =>
      current.map((slide) => (slide.id === slideId ? { ...slide, background: { ...slide.background, ...patch } } : slide)),
    )
    return true
  }

  const deleteSlide: AiEditorController['deleteSlide'] = (slideId) => {
    const slides = io.getSlides()
    if (slides.length <= 1) return false
    if (!slides.some((slide) => slide.id === slideId)) return false
    io.setSlides((current) => current.filter((slide) => slide.id !== slideId))
    return true
  }

  const addElement: AiEditorController['addElement'] = (slideId, element) => {
    const slide = findSlide(slideId)
    // HTML screens own their entire surface; structured elements would be invisible on them.
    if (!slide || slide.html !== undefined) return null
    const id = uid(element.type)
    const newElement = { ...element, id } as CanvasElement
    io.setSlides((current) =>
      current.map((slide) => (slide.id === slideId ? { ...slide, elements: [...slide.elements, newElement] } : slide)),
    )
    return id
  }

  const updateElement: AiEditorController['updateElement'] = (slideId, elementId, patch) => {
    const slide = findSlide(slideId)
    if (!slide) return false
    const element = slide.elements.find((candidate) => candidate.id === elementId)
    if (!element) return false

    const allowedKeys = new Set([...BASE_UPDATE_KEYS, ...TYPE_UPDATE_KEYS[element.type]])
    const filteredPatch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (allowedKeys.has(key)) filteredPatch[key] = value
    }
    // A rewritten `text` invalidates any stale rich-text formatting stored in `html`,
    // unless the patch carries a freshly built `html` alongside it.
    if (element.type === 'text' && 'text' in filteredPatch && !('html' in filteredPatch)) {
      filteredPatch['html'] = undefined
    }

    io.setSlides((current) =>
      current.map((s) =>
        s.id === slideId
          ? {
              ...s,
              elements: s.elements.map((el) => (el.id === elementId ? ({ ...el, ...filteredPatch }) : el)),
            }
          : s,
      ),
    )
    return true
  }

  const deleteElement: AiEditorController['deleteElement'] = (slideId, elementId) => {
    const slide = findSlide(slideId)
    if (!slide) return false
    if (!slide.elements.some((element) => element.id === elementId)) return false
    io.setSlides((current) =>
      current.map((s) => (s.id === slideId ? { ...s, elements: s.elements.filter((el) => el.id !== elementId) } : s)),
    )
    return true
  }

  const getAssetSrc: AiEditorController['getAssetSrc'] = (assetId) => io.getUploads().find((asset) => asset.id === assetId)?.src

  const addAsset: AiEditorController['addAsset'] = ({ name, src }) => {
    const id = uid('upload')
    const asset: UploadAsset = { id, name, src }
    io.setUploads((current) => [asset, ...current])
    return id
  }

  return {
    snapshot,
    addSlide,
    addHtmlSlide,
    renameSlide,
    setSlideBackground,
    setSlideHtml,
    deleteSlide,
    addElement,
    updateElement,
    deleteElement,
    getAssetSrc,
    addAsset,
  }
}

export function scopeAiControllerToSlide(controller: AiEditorController, targetSlideId: string): AiEditorController {
  const isTarget = (slideId: string) => slideId === targetSlideId

  return {
    snapshot: () => {
      const snapshot = controller.snapshot()
      return {
        ...snapshot,
        slides: snapshot.slides.filter((slide) => slide.id === targetSlideId),
      }
    },
    // Slide creation and deletion are not exposed in edit mode. These guards
    // keep the scoped controller safe if that tool boundary changes later.
    addSlide: () => '',
    addHtmlSlide: () => '',
    renameSlide: (slideId, name) => isTarget(slideId) && controller.renameSlide(slideId, name),
    setSlideBackground: (slideId, patch) => isTarget(slideId) && controller.setSlideBackground(slideId, patch),
    setSlideHtml: (slideId, html) => isTarget(slideId) && controller.setSlideHtml(slideId, html),
    deleteSlide: () => false,
    addElement: (slideId, element) => isTarget(slideId) ? controller.addElement(slideId, element) : null,
    updateElement: (slideId, elementId, patch) => isTarget(slideId) && controller.updateElement(slideId, elementId, patch),
    deleteElement: (slideId, elementId) => isTarget(slideId) && controller.deleteElement(slideId, elementId),
    getAssetSrc: (assetId) => controller.getAssetSrc(assetId),
    addAsset: (input) => controller.addAsset(input),
  }
}

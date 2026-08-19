import type { CanvasElement, Slide, UploadAsset } from './types'

/**
 * Every place project data embeds an image source: upload assets, slide
 * background images, image elements, and device screenshots. AI-authored
 * `slide.html` is excluded on purpose — it references uploads through
 * `asset:` upload ids and may only embed small self-authored SVG data URIs.
 */
export type ProjectAssetSources = {
  slides: Slide[]
  uploads: UploadAsset[]
}

export const collectAssetSources = ({ slides, uploads }: ProjectAssetSources): Set<string> => {
  const sources = new Set<string>()
  for (const upload of uploads) sources.add(upload.src)
  for (const slide of slides) {
    if (slide.background.image) sources.add(slide.background.image)
    for (const element of slide.elements) {
      if (element.type === 'image') sources.add(element.src)
      else if (element.type === 'device' && element.screenshot) sources.add(element.screenshot)
    }
  }
  return sources
}

const mapElementSources = (element: CanvasElement, map: (src: string) => string): CanvasElement => {
  if (element.type === 'image') {
    const src = map(element.src)
    return src === element.src ? element : { ...element, src }
  }
  if (element.type === 'device' && element.screenshot) {
    const screenshot = map(element.screenshot)
    return screenshot === element.screenshot ? element : { ...element, screenshot }
  }
  return element
}

const mapBackgroundSources = (background: Slide['background'], map: (src: string) => string): Slide['background'] => {
  if (background.image === undefined) return background
  const image = map(background.image)
  return image === background.image ? background : { ...background, image }
}

const mapSlideSources = (slide: Slide, map: (src: string) => string): Slide => {
  const background = mapBackgroundSources(slide.background, map)
  const elements = slide.elements.map((element) => mapElementSources(element, map))
  const elementsChanged = elements.some((element, index) => element !== slide.elements[index])
  if (background === slide.background && !elementsChanged) return slide
  return {
    ...slide,
    background,
    elements: elementsChanged ? elements : slide.elements,
  }
}

/** Returns a structurally shared copy with every image source passed through `map`. */
export const mapAssetSources = <T extends ProjectAssetSources>(project: T, map: (src: string) => string): T => {
  const uploads = project.uploads.map((upload) => {
    const src = map(upload.src)
    return src === upload.src ? upload : { ...upload, src }
  })
  const slides = project.slides.map((slide) => mapSlideSources(slide, map))
  return { ...project, uploads, slides }
}

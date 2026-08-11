import { getFontEmbedCSS, toJpeg } from 'html-to-image'
import { settleFrames } from './measure'

// getFontEmbedCSS is expensive (it fetches and inlines every @font-face rule used on the page),
// so compute it once per module and reuse it for every preview capture across the whole AI run.
let fontEmbedCSSPromise: Promise<string | undefined> | null = null

export const AI_PREVIEW_WIDTH = 330
export const AI_PREVIEW_HEIGHT = 715

const getCachedFontEmbedCSS = (node: HTMLElement): Promise<string | undefined> => {
  fontEmbedCSSPromise ??= getFontEmbedCSS(node).catch((error: unknown) => {
    console.warn('Failed to compute font embed CSS for slide preview capture', error)
    return undefined
  })
  return fontEmbedCSSPromise
}

export async function captureSlidePreview(slideId: string): Promise<{ base64: string; mediaType: 'image/jpeg' } | null> {
  await settleFrames()
  const node = document.getElementById(`artboard-${slideId}`)
  if (!node) return null

  try {
    const fontEmbedCSS = await getCachedFontEmbedCSS(node)
    const dataUrl = await toJpeg(node, {
      // The editor's source artboard is 330px wide. Capturing above that merely
      // upscales the same layout and adds vision tokens without new information.
      canvasWidth: AI_PREVIEW_WIDTH,
      canvasHeight: AI_PREVIEW_HEIGHT,
      pixelRatio: 1,
      quality: 0.8,
      ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
      filter: (candidate) =>
        !(candidate instanceof HTMLElement && candidate.dataset['aiOverlay']),
    })
    return { base64: dataUrl.replace(/^data:image\/jpeg;base64,/, ''), mediaType: 'image/jpeg' }
  } catch (error) {
    console.warn(`Failed to capture preview for slide ${slideId}`, error)
    return null
  }
}

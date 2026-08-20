import { toCanvas } from 'html-to-image'
import { EXPORT_ARTBOARD_WIDTH, EXPORT_FORMATS } from './export-formats'
import type { Slide } from '../types'

/**
 * Renders the Open Graph preview image for a share link: up to three screens
 * captured from the live artboard DOM, composed on a gradient drawn from the
 * first screen's background colors, with the project name set in the UI face.
 * The share flow treats the preview as best-effort — any failure returns null
 * and the link still works, it just unfurls without an image.
 */

export const SHARE_PREVIEW_WIDTH = 1200
export const SHARE_PREVIEW_HEIGHT = 630

const MAX_PREVIEW_SCREENS = 3
const PREVIEW_JPEG_QUALITY = 0.9

const ARTBOARD_ASPECT = EXPORT_FORMATS[0].width / EXPORT_FORMATS[0].height

const captureSlideCanvas = async (slide: Slide, screenHeight: number): Promise<HTMLCanvasElement | null> => {
  const node = document.getElementById(`artboard-${slide.id}`)
  if (!node) return null
  try {
    return await toCanvas(node, {
      pixelRatio: 1,
      width: EXPORT_ARTBOARD_WIDTH,
      height: EXPORT_ARTBOARD_WIDTH / ARTBOARD_ASPECT,
      canvasWidth: Math.round(screenHeight * ARTBOARD_ASPECT),
      canvasHeight: screenHeight,
      backgroundColor: slide.background.color1,
      filter: (candidate: HTMLElement) =>
        !(candidate instanceof HTMLElement && candidate.dataset['aiOverlay']),
    })
  } catch {
    return null
  }
}

const parseHexColor = (value: string): { r: number; g: number; b: number } | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim())
  if (!match?.[1]) return null
  const hex = Number.parseInt(match[1], 16)
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 }
}

const isLightColor = (value: string): boolean => {
  const rgb = parseHexColor(value)
  if (!rgb) return false
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.62
}

type ScreenPlacement = { x: number; y: number; rotation: number; height: number; z: number }

// Indexed by slide order: the first screen takes the hero spot in front.
const screenPlacements = (count: number): ScreenPlacement[] => {
  if (count >= 3) {
    return [
      { x: 860, y: 310, rotation: 0.02, height: 500, z: 2 },
      { x: 690, y: 345, rotation: -0.1, height: 470, z: 0 },
      { x: 1030, y: 360, rotation: 0.12, height: 470, z: 1 },
    ]
  }
  if (count === 2) {
    return [
      { x: 750, y: 340, rotation: -0.07, height: 490, z: 1 },
      { x: 985, y: 320, rotation: 0.06, height: 490, z: 0 },
    ]
  }
  return [{ x: 880, y: 330, rotation: 0.03, height: 540, z: 0 }]
}

const drawScreen = (
  context: CanvasRenderingContext2D,
  screen: HTMLCanvasElement,
  placement: ScreenPlacement,
) => {
  const height = placement.height
  const width = Math.round(height * ARTBOARD_ASPECT)
  context.save()
  context.translate(placement.x, placement.y)
  context.rotate(placement.rotation)
  const frame = new Path2D()
  frame.roundRect(-width / 2, -height / 2, width, height, 18)
  context.shadowColor = 'rgba(10, 12, 24, 0.45)'
  context.shadowBlur = 42
  context.shadowOffsetY = 22
  context.fillStyle = '#ffffff'
  context.fill(frame)
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.clip(frame)
  context.drawImage(screen, -width / 2, -height / 2, width, height)
  context.restore()
}

const wrapProjectName = (
  context: CanvasRenderingContext2D,
  name: string,
  maxWidth: number,
): string[] => {
  const words = name.trim().split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (current !== '' && context.measureText(candidate).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
    if (lines.length === 2) break
  }
  if (lines.length < 2 && current !== '') lines.push(current)
  const lastLine = lines[lines.length - 1]
  if (lastLine && context.measureText(lastLine).width > maxWidth) {
    let trimmed = lastLine
    while (trimmed.length > 1 && context.measureText(`${trimmed}…`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1)
    }
    lines[lines.length - 1] = `${trimmed}…`
  }
  return lines
}

const drawBackdrop = (context: CanvasRenderingContext2D, slide: Slide | undefined) => {
  const color1 = slide?.background.color1 ?? '#101014'
  const color2 = slide?.background.color2 ?? '#1c1c26'
  const gradient = context.createLinearGradient(0, 0, SHARE_PREVIEW_WIDTH, SHARE_PREVIEW_HEIGHT)
  gradient.addColorStop(0, parseHexColor(color1) ? color1 : '#101014')
  gradient.addColorStop(1, parseHexColor(color2) ? color2 : '#1c1c26')
  context.fillStyle = gradient
  context.fillRect(0, 0, SHARE_PREVIEW_WIDTH, SHARE_PREVIEW_HEIGHT)

  // A quiet vignette keeps white artboards from bleeding into the canvas edge
  // and gives the name block contrast on light gradients.
  const vignette = context.createLinearGradient(0, 0, SHARE_PREVIEW_WIDTH * 0.7, 0)
  vignette.addColorStop(0, 'rgba(8, 9, 18, 0.34)')
  vignette.addColorStop(1, 'rgba(8, 9, 18, 0)')
  context.fillStyle = vignette
  context.fillRect(0, 0, SHARE_PREVIEW_WIDTH, SHARE_PREVIEW_HEIGHT)
  return isLightColor(color1)
}

const drawNameBlock = (context: CanvasRenderingContext2D, projectName: string, onLight: boolean) => {
  const ink = onLight ? '#15161c' : '#ffffff'
  const muted = onLight ? 'rgba(21, 22, 28, 0.66)' : 'rgba(255, 255, 255, 0.72)'
  const fontStack = '\'Instrument Sans Variable\', \'Instrument Sans\', system-ui, sans-serif'

  context.textBaseline = 'alphabetic'
  context.fillStyle = muted
  context.font = `600 21px ${fontStack}`
  try {
    context.letterSpacing = '4px'
  } catch {
    // Older engines without canvas letter spacing simply render tighter.
  }
  context.fillText('SHOTLUMA', 84, 214)
  try {
    context.letterSpacing = '0px'
  } catch {
    // See above.
  }

  context.fillStyle = ink
  context.font = `640 58px ${fontStack}`
  const lines = wrapProjectName(context, projectName, 430)
  lines.forEach((line, index) => {
    context.fillText(line, 84, 288 + index * 70)
  })

  context.fillStyle = muted
  context.font = `500 22px ${fontStack}`
  context.fillText('Open the link to edit', 84, 320 + lines.length * 70)
  context.fillText('your own copy.', 84, 352 + lines.length * 70)
}

const canvasToJpeg = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', PREVIEW_JPEG_QUALITY)
  })

export const createSharePreviewImage = async (
  projectName: string,
  slides: Slide[],
): Promise<Blob | null> => {
  try {
    await document.fonts.ready
    const shown = slides.slice(0, MAX_PREVIEW_SCREENS)
    const placements = screenPlacements(shown.length)
    const screens = await Promise.all(
      shown.map((slide, index) => captureSlideCanvas(slide, placements[index]?.height ?? 470)),
    )

    const canvas = document.createElement('canvas')
    canvas.width = SHARE_PREVIEW_WIDTH
    canvas.height = SHARE_PREVIEW_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return null

    const onLight = drawBackdrop(context, shown[0])
    screens
      .map((screen, index) => ({ screen, placement: placements[index] }))
      .filter((entry): entry is { screen: HTMLCanvasElement; placement: ScreenPlacement } =>
        entry.screen !== null && entry.placement !== undefined)
      .sort((a, b) => a.placement.z - b.placement.z)
      .forEach(({ screen, placement }) => {
        drawScreen(context, screen, placement)
      })
    drawNameBlock(context, projectName.trim() === '' ? 'Shared project' : projectName, onLight)
    return await canvasToJpeg(canvas)
  } catch {
    return null
  }
}

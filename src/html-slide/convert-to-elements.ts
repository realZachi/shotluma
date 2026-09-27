import { uid } from '../utils'
import { resolveAssetReferences } from './assets'
import { deviceElementFromAttributes } from './device-attributes'
import { sanitizeScreenHtml } from './sanitize'
import type { Background, CanvasElement, DeviceElement, ImageElement, Slide, TextElement, UploadAsset } from '../types'

const ROTATE_REGEX = /rotate\((-?\d+(?:\.\d+)?(?:deg)?)\)/

/**
 * Converts an AI-authored HTML slide into structured, interactive canvas elements.
 * Extracts all <shotluma-device> mockups as draggable DeviceElements,
 * text nodes (h1-h6, p, headlines) as editable TextElements, and images/logos as ImageElements.
 */
export function convertHtmlSlideToElements(
  slide: Slide,
  uploads: UploadAsset[],
): { background: Background; elements: CanvasElement[] } {
  if (!slide.html) {
    return { background: slide.background, elements: slide.elements }
  }

  const { html: sanitized } = sanitizeScreenHtml(slide.html)
  const resolved = resolveAssetReferences(
    sanitized,
    (assetId) => uploads.find((asset) => asset.id === assetId)?.src,
  )

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${resolved}</body>`, 'text/html')
  const body = doc.body

  const elements: CanvasElement[] = []
  let background: Background = { ...slide.background }

  // Check root container style for background color / gradient
  const root = body.firstElementChild as HTMLElement | null
  if (root) {
    const bg = root.style.background || root.style.backgroundColor
    if (bg && (bg.startsWith('#') || bg.startsWith('rgb'))) {
      background = {
        type: 'solid',
        color1: bg,
        color2: bg,
        angle: 0,
      }
    }
  }

  // 1. Convert <shotluma-device> elements
  const deviceNodes = Array.from(body.querySelectorAll<HTMLElement>('shotluma-device'))
  deviceNodes.forEach((node, index) => {
    const devElem = deviceElementFromAttributes({
      mockup: node.getAttribute('mockup'),
      screenshot: node.getAttribute('screenshot'),
      theme: node.getAttribute('theme'),
      shadow: node.getAttribute('shadow'),
    }, index)

    const style = node.style
    let x = 12
    let y = 36 + index * 10
    let width = 76
    let rotation = 0

    if (style.left?.includes('%')) x = parseFloat(style.left) || x
    if (style.top?.includes('%')) y = parseFloat(style.top) || y
    if (style.width?.includes('%')) width = parseFloat(style.width) || width
    if (style.transform?.includes('rotate(')) {
      const match = ROTATE_REGEX.exec(style.transform)
      if (match?.[1]) rotation = parseFloat(match[1]) || 0
    }

    const device: DeviceElement = {
      ...devElem,
      id: uid('device'),
      x,
      y,
      width,
      rotation,
      opacity: 1,
    }
    elements.push(device)
  })

  // 2. Convert text nodes (headings, paragraphs, labels)
  const allTextNodes = Array.from(body.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, h5, h6, p, .headline, .subtitle, .badge, .copy',
  ))
  const topTextNodes = allTextNodes.filter((node) => {
    let parent = node.parentElement
    while (parent && parent !== body) {
      if (allTextNodes.includes(parent)) return false
      parent = parent.parentElement
    }
    return true
  })

  topTextNodes.forEach((node, index) => {
    const text = node.textContent.trim()
    if (!text) return

    const tag = node.tagName.toLowerCase()
    const isHeading = ['h1', 'h2', 'h3'].includes(tag) || node.classList.contains('headline')
    const fontSize = isHeading ? (tag === 'h1' ? 44 : 36) : 22
    const fontWeight = isHeading ? 700 : 400

    let color = '#ffffff'
    if (node.style.color) color = node.style.color
    else if (background.color1 === '#ffffff' || background.color1 === '#f8f8f6') color = '#111116'

    let x = 8
    let y = 8 + index * 14
    let width = 84

    if (styleHasPercent(node.style.left)) x = parseFloat(node.style.left) || x
    if (styleHasPercent(node.style.top)) y = parseFloat(node.style.top) || y
    if (styleHasPercent(node.style.width)) width = parseFloat(node.style.width) || width

    const textElem: TextElement = {
      id: uid('text'),
      type: 'text',
      text,
      x,
      y,
      width,
      rotation: 0,
      opacity: 1,
      color,
      fontFamily: isHeading ? 'Bricolage Grotesque Variable' : 'Instrument Sans Variable',
      fontSize,
      fontWeight,
      align: 'center',
      lineHeight: 1.15,
      letterSpacing: isHeading ? -0.5 : 0,
    }
    elements.push(textElem)
  })

  // 3. Convert standalone <img> elements (logos / badges)
  const imgNodes = Array.from(body.querySelectorAll<HTMLImageElement>('img'))
  imgNodes.forEach((img, index) => {
    if (img.closest('shotluma-device')) return
    const src = img.getAttribute('src') || img.src || ''
    if (!src) return

    let x = 40
    let y = 6 + index * 10
    let width = 20

    if (img.style.left?.includes('%')) x = parseFloat(img.style.left) || x
    if (img.style.top?.includes('%')) y = parseFloat(img.style.top) || y
    if (img.style.width?.includes('%')) width = parseFloat(img.style.width) || width

    const imgElem: ImageElement = {
      id: uid('image'),
      type: 'image',
      src,
      x,
      y,
      width,
      rotation: 0,
      opacity: 1,
      borderRadius: 14,
      shadow: 20,
    }
    elements.push(imgElem)
  })

  return { background, elements }
}

function styleHasPercent(val: string | undefined): val is string {
  return typeof val === 'string' && val.includes('%')
}

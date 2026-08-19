import type { Background } from './types'
import type { CSSProperties } from 'react'

export const uid = (prefix = 'item') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('The file could not be read as a data URL.'))
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  const bigint = Number.parseInt(normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const getBackgroundStyle = (background: Background): CSSProperties => {
  if (background.type === 'image') {
    const overlay = hexToRgba(background.overlayColor ?? '#111116', clamp(background.overlayOpacity ?? 0.18, 0, 1))
    const image = background.image ? `url("${background.image}")` : 'none'
    return {
      backgroundColor: background.color1,
      backgroundImage: `linear-gradient(${overlay}, ${overlay}), ${image}`,
      backgroundSize: `cover, ${background.imageFit ?? 'cover'}`,
      backgroundPosition: `center, ${background.imagePosition ?? 'center'}`,
      backgroundRepeat: 'no-repeat',
    }
  }

  if (background.type === 'gradient') {
    return {
      backgroundColor: background.color1,
      backgroundImage: background.gradientKind === 'radial'
        ? `radial-gradient(circle at 24% 18%, ${background.color1}, ${background.color2} 78%)`
        : `linear-gradient(${background.angle}deg, ${background.color1}, ${background.color2})`,
    }
  }

  return { backgroundColor: background.color1 }
}

const RICH_TEXT_INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'span', 'br'])
const RICH_TEXT_TAG_ALIASES: Record<string, string> = { strong: 'b', em: 'i', strike: 's' }
const RICH_TEXT_BLOCK_TAGS = new Set(['div', 'p'])
const RICH_TEXT_DROP_TAGS = new Set(['script', 'style', 'head'])

const appendRichTextChildren = (source: Node, target: Node) => {
  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent ?? ''))
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as Element
    const tag = element.tagName.toLowerCase()

    if (RICH_TEXT_DROP_TAGS.has(tag)) return

    if (RICH_TEXT_BLOCK_TAGS.has(tag)) {
      if (target.childNodes.length > 0) target.appendChild(document.createElement('br'))
      appendRichTextChildren(element, target)
      return
    }

    if (tag === 'br') {
      target.appendChild(document.createElement('br'))
      return
    }

    if (!RICH_TEXT_INLINE_TAGS.has(tag)) {
      // Unknown inline tag: drop the tag, keep its text content.
      appendRichTextChildren(element, target)
      return
    }

    const normalizedTag = RICH_TEXT_TAG_ALIASES[tag] ?? tag

    if (normalizedTag === 'span') {
      const style = (element as HTMLElement).style
      const keptStyles: string[] = []
      if (style.color) keptStyles.push(`color: ${style.color}`)
      if (style.fontWeight) keptStyles.push(`font-weight: ${style.fontWeight}`)
      if (style.backgroundColor) keptStyles.push(`background-color: ${style.backgroundColor}`)
      if (style.borderRadius) keptStyles.push(`border-radius: ${style.borderRadius}`)
      if (style.padding) keptStyles.push(`padding: ${style.padding}`)
      if (style.opacity) keptStyles.push(`opacity: ${style.opacity}`)
      if (keptStyles.length === 0) {
        // No surviving style: unwrap the span, keep its children.
        appendRichTextChildren(element, target)
        return
      }
      const span = document.createElement('span')
      span.setAttribute('style', keptStyles.join('; '))
      appendRichTextChildren(element, span)
      target.appendChild(span)
      return
    }

    const wrapper = document.createElement(normalizedTag)
    appendRichTextChildren(element, wrapper)
    target.appendChild(wrapper)
  })
}

export function sanitizeRichText(input: string): string {
  const parsed = new DOMParser().parseFromString(input, 'text/html')
  const output = document.createElement('div')
  appendRichTextChildren(parsed.body, output)

  while (output.lastElementChild?.tagName === 'BR') {
    output.lastElementChild.remove()
  }

  return output.innerHTML
}

export function richTextToPlain(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  parsed.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return parsed.body.textContent
}

export function richTextHasFormatting(html: string): boolean {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return Boolean(parsed.querySelector('b, i, u, s, span'))
}

export const getBackgroundPatternStyle = (background: Background): CSSProperties => ({
  '--pattern-color': hexToRgba(background.patternColor ?? '#ffffff', clamp(background.patternOpacity ?? 0.12, 0, 0.8)),
  '--pattern-size': `${clamp(background.patternScale ?? 28, 10, 80)}px`,
} as CSSProperties)

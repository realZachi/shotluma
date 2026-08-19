export type ScreenHtmlSanitization = {
  /** Serialized sanitized markup, safe for dangerouslySetInnerHTML. */
  html: string
  /** Human-readable descriptions of everything that was stripped, for AI feedback. */
  violations: string[]
}

const svgNamespace = 'http://www.w3.org/2000/svg'

const toLowerSet = (names: readonly string[]) => new Set(names.map((name) => name.toLowerCase()))

const allowedHtmlElements = toLowerSet([
  'div', 'span', 'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sup', 'sub',
  'br', 'hr', 'img',
  'section', 'header', 'footer', 'main', 'article', 'aside',
  'figure', 'figcaption', 'blockquote',
  'style',
  'shotluma-device',
])

const allowedSvgElements = toLowerSet([
  'svg', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon',
  'g', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask',
  'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode', 'feColorMatrix',
  'feFlood', 'feComposite', 'feBlend', 'feDropShadow',
  'use', 'symbol', 'text', 'tspan', 'title', 'desc',
])

const globalHtmlAttributes = toLowerSet(['class', 'style', 'id'])

const htmlAttributesByElement = new Map<string, ReadonlySet<string>>([
  ['img', toLowerSet(['src', 'alt', 'width', 'height'])],
  ['shotluma-device', toLowerSet(['mockup', 'screenshot', 'theme', 'shadow'])],
])

const urlAttributes = toLowerSet(['src', 'href', 'xlink:href'])

const allowedUrlPrefixes = ['asset:', 'data:image/', '#']

const isAllowedUrl = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return allowedUrlPrefixes.some((prefix) => normalized.startsWith(prefix))
}

const isAllowedCssUrl = (value: string): boolean => {
  const normalized = value.trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase()
  return normalized.startsWith('data:image/') || normalized.startsWith('asset:')
}

// SVG presentation attributes (fill, filter, mask, clip-path, …) accept url()
// references that the browser resolves as loads; only same-document fragments
// are safe there.
const SVG_URL_TOKEN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/gi

const hasNonFragmentSvgUrl = (value: string): boolean => {
  for (const match of value.matchAll(SVG_URL_TOKEN)) {
    const target = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (!target.startsWith('#')) return true
  }
  return false
}

// Regex-level scanning is deliberate: a full CSS parser is not needed to enforce
// "no network loads", and anything unrecognized stays untouched inside the sandbox.
const sanitizeCssText = (css: string, context: string, violations: string[]): string => {
  const importRule = /@import\b[^;]*(?:;|$)/gi
  const urlToken = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)/gi

  const withoutImports = css.replace(importRule, () => {
    violations.push(`Removed @import rule in ${context}.`)
    return ''
  })

  return withoutImports.replace(urlToken, (
    token: string,
    doubleQuoted?: string,
    singleQuoted?: string,
    bare?: string,
  ) => {
    const value = doubleQuoted ?? singleQuoted ?? bare ?? ''
    if (isAllowedCssUrl(value)) return token
    violations.push(`Replaced external url() in ${context} with none.`)
    return 'none'
  })
}

const isAllowedElement = (element: Element, tagName: string): boolean => (
  element.namespaceURI === svgNamespace
    ? allowedSvgElements.has(tagName)
    : allowedHtmlElements.has(tagName)
)

const isAllowedHtmlAttribute = (tagName: string, attributeName: string): boolean => (
  globalHtmlAttributes.has(attributeName) || (htmlAttributesByElement.get(tagName)?.has(attributeName) ?? false)
)

const sanitizeAttributeValue = (element: Element, tagName: string, name: string, violations: string[]) => {
  const value = element.getAttribute(name) ?? ''
  if (urlAttributes.has(name)) {
    if (isAllowedUrl(value)) return
    element.removeAttribute(name)
    violations.push(`Removed external URL in "${name}" on <${tagName}>.`)
    return
  }
  if (name === 'style') {
    const cleaned = sanitizeCssText(value, `the style attribute of <${tagName}>`, violations)
    if (cleaned !== value) element.setAttribute(name, cleaned)
    return
  }
  if (element.namespaceURI === svgNamespace && hasNonFragmentSvgUrl(value)) {
    element.removeAttribute(name)
    violations.push(`Removed non-fragment url() in "${name}" on <${tagName}>.`)
  }
}

const sanitizeAttribute = (element: Element, tagName: string, name: string, violations: string[]) => {
  if (name.startsWith('on')) {
    element.removeAttribute(name)
    violations.push(`Removed event handler attribute "${name}" on <${tagName}>.`)
    return
  }
  const isSvg = element.namespaceURI === svgNamespace
  // SVG keeps its camelCase presentation attributes; without animation elements,
  // foreignObject, and handlers there is no script-bearing SVG attribute left.
  if (!isSvg && !isAllowedHtmlAttribute(tagName, name)) {
    element.removeAttribute(name)
    violations.push(`Removed disallowed attribute "${name}" on <${tagName}>.`)
    return
  }
  sanitizeAttributeValue(element, tagName, name, violations)
}

const sanitizeAttributes = (element: Element, tagName: string, violations: string[]) => {
  for (const attribute of [...element.attributes]) {
    sanitizeAttribute(element, tagName, attribute.name.toLowerCase(), violations)
  }
}

const sanitizeStyleElement = (element: Element, violations: string[]) => {
  const css = element.textContent
  const cleaned = sanitizeCssText(css, 'a <style> element', violations)
  if (cleaned !== css) element.textContent = cleaned
}

const sanitizeElement = (element: Element, violations: string[]) => {
  const tagName = element.localName.toLowerCase()
  if (!isAllowedElement(element, tagName)) {
    violations.push(`Removed disallowed element <${tagName}>.`)
    element.remove()
    return
  }
  sanitizeAttributes(element, tagName, violations)
  // html-to-image throws on an <img> with no loadable src, which would break
  // preview and export for the whole screen — drop the useless element instead.
  if (tagName === 'img' && !element.getAttribute('src')) {
    violations.push('Removed <img> without a usable src.')
    element.remove()
    return
  }
  if (tagName === 'style' && element.namespaceURI !== svgNamespace) {
    sanitizeStyleElement(element, violations)
    return
  }
  sanitizeChildren(element, violations)
}

const sanitizeChildren = (parent: Node, violations: string[]) => {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      parent.removeChild(node)
      continue
    }
    if (node.nodeType === Node.ELEMENT_NODE) sanitizeElement(node as Element, violations)
  }
}

// The HTML parser hoists <style>, <script>, <meta>, and friends into <head>; moving them
// back keeps allowed styling alive and still reports everything that gets removed.
const moveHeadIntoBody = (parsed: Document) => {
  const reference = parsed.body.firstChild
  for (const node of [...parsed.head.childNodes]) parsed.body.insertBefore(node, reference)
}

export const sanitizeScreenHtml = (input: string): ScreenHtmlSanitization => {
  const violations: string[] = []
  try {
    const parsed = new DOMParser().parseFromString(input, 'text/html')
    moveHeadIntoBody(parsed)
    sanitizeChildren(parsed.body, violations)
    return { html: parsed.body.innerHTML, violations }
  } catch {
    return { html: '', violations: ['Removed markup that could not be parsed.'] }
  }
}

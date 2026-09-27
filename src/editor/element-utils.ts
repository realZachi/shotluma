import { uid } from '../utils'
import type { CanvasElement } from '../types'

export const freshElementIds = (elements: CanvasElement[]) =>
  elements.map((element) => ({ ...element, id: uid(element.type) }))

export const resolveElementText = (
  element: Extract<CanvasElement, { type: 'text' }>,
  locale?: string,
) => {
  if (locale && locale !== 'en-US' && element.translations?.[locale]) {
    const translation = element.translations[locale]
    return {
      text: translation.text,
      html: translation.html,
    }
  }
  return {
    text: element.text,
    html: element.html,
  }
}

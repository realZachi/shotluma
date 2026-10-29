import { getContrastTextColor } from './utils'
import type { TextElement, TextStylePresetId } from './types'

export type TextStylePresetOption = {
  id: TextStylePresetId
  label: string
}

/**
 * One-click text style presets for the text toolbar (closes issue #10,
 * "Add one-click text style presets to the text toolbar"). Each preset
 * returns a full patch of the properties it owns, so applying one is a
 * single `onUpdate` call and therefore a single undo step. Presets reuse the
 * text element's current color for any background or stroke they introduce,
 * so they stay consistent with whatever palette the user already picked
 * instead of injecting a fixed brand color.
 */
export const textStylePresetOptions: TextStylePresetOption[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'pill', label: 'Pill' },
  { id: 'card', label: 'Card' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'outline', label: 'Outline' },
]

type TextStylePatch = Pick<
  TextElement,
  'color' | 'backgroundColor' | 'backgroundOpacity' | 'padding' | 'borderRadius' | 'strokeColor' | 'strokeWidth' | 'shadow'
>

/**
 * Pill and Highlight flip `color` to a computed contrast so their solid fill
 * stays readable; every other preset (including re-applying Plain) must read
 * the user's real brand color back out, not that flipped display value.
 * `backgroundColor` is the one field no preset ever derives from a flip — it
 * is always written straight from the then-current brand color — so once a
 * solid-fill preset has run, it is the reliable source. `backgroundOpacity`
 * tells us whether that happened: a fresh element ships with a placeholder
 * `backgroundColor` (opacity 0, never shown), so that placeholder must be
 * ignored in favor of the plain `color` until a preset actually turns it on.
 */
const getBrandColor = (element: TextElement): string =>
  (element.backgroundOpacity ?? 0) > 0 && element.backgroundColor
    ? element.backgroundColor
    : element.color

export const getTextStylePresetPatch = (
  element: TextElement,
  preset: TextStylePresetId,
): Partial<TextStylePatch> => {
  const brandColor = getBrandColor(element)
  switch (preset) {
    case 'plain':
      return { color: brandColor, backgroundOpacity: 0, padding: 0, borderRadius: 0, strokeWidth: 0, shadow: 0 }
    case 'pill':
      return {
        backgroundColor: brandColor,
        backgroundOpacity: 1,
        padding: 14,
        borderRadius: 40,
        strokeWidth: 0,
        shadow: 0,
        color: getContrastTextColor(brandColor),
      }
    case 'card':
      return {
        backgroundColor: brandColor,
        backgroundOpacity: 0.14,
        padding: 16,
        borderRadius: 16,
        strokeWidth: 0,
        shadow: 0,
        color: brandColor,
      }
    case 'highlight':
      return {
        backgroundColor: brandColor,
        backgroundOpacity: 1,
        padding: 3,
        borderRadius: 3,
        strokeWidth: 0,
        shadow: 0,
        color: getContrastTextColor(brandColor),
      }
    case 'outline':
      return {
        color: brandColor,
        backgroundOpacity: 0,
        padding: 0,
        borderRadius: 0,
        shadow: 0,
        strokeWidth: 1.5,
        strokeColor: getContrastTextColor(brandColor),
      }
    default:
      return {}
  }
}

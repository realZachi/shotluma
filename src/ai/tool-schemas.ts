import { z } from 'zod'
import { iconIds } from '../icons'

export const COORDINATE_NOTE = 'Canvas percent: x/y are the top-left; width uses canvas width; height is automatic. Range: x/y -35..97, width 8..140.'

export const MEASUREMENT_NOTE = 'Returns the rendered box and warnings involving this element.'

export const fontFamilySchema = z
  .enum([
    'Bricolage Grotesque Variable',
    'Syne Variable',
    'Bebas Neue',
    'Archivo Black',
    'Anton',
    'Instrument Sans Variable',
    'Manrope Variable',
    'Outfit Variable',
    'Plus Jakarta Sans Variable',
    'Sora Variable',
    'Inter Tight Variable',
    'Fraunces',
    'Playfair Display',
    'DM Serif Display',
    'Libre Baskerville',
    'Cormorant Garamond',
    'Space Mono',
    'JetBrains Mono',
    'Caveat',
    'Permanent Marker',
    'Arial, sans-serif',
  ])
  .describe(
    'Loaded font family. The prompt lists supported weights and intended uses.',
  )

export const shapeSchema = z.enum([
  'circle',
  'square',
  'rounded-square',
  'pill',
  'triangle',
  'diamond',
  'star',
  'burst',
  'spark',
  'blob',
  'arch',
  'ring',
  'line',
  'arrow',
  'wave',
])

export const iconSchema = z
  .enum(iconIds)
  .describe(
    'Curated Hugeicons id. Use these vector icons instead of emoji.',
  )

export const backgroundPatternSchema = z.enum([
  'none',
  'dots',
  'grid',
  'diagonal',
  'waves',
])

export const deviceStyleSchema = z
  .enum([
    'iphone-17-a',
    'iphone-17-b',
    'iphone-17-c',
    'iphone-17-d',
    'iphone-17-e',
    'iphone-17-f',
    'tilted-hand',
  ])
  .describe(
    'Photorealistic iPhone style. The prompt gives composition ranges for each style.',
  )

export const screenThemeSchema = z
  .enum(['coral', 'mint', 'night', 'sun'])
  .describe('Tint applied to the device chrome/background behind the screenshot.')

const textHighlightSchema = z.object({
  text: z.string().describe('Exact substring of the element text to style. Every exact occurrence of it gets this styling.'),
  color: z.string().optional().describe('Hex text color for just this part, e.g. the accent color.'),
  backgroundColor: z.string().optional().describe('Hex background color behind just this part — the highlighter-pen / pill look.'),
  backgroundOpacity: z.number().optional().describe('Opacity of that background, 0-1. Defaults to 1.'),
  borderRadius: z.number().optional().describe('Corner radius of that background in px on the internal 330px canvas base, 0-24. Only visible together with backgroundColor.'),
  padding: z.number().optional().describe('Horizontal padding around the highlighted part in internal px, 0-12. Use with backgroundColor for a pill.'),
  bold: z.boolean().optional().describe('Render just this part bold.'),
  italic: z.boolean().optional().describe('Render just this part italic.'),
  underline: z.boolean().optional().describe('Underline just this part.'),
  strikethrough: z.boolean().optional().describe('Strike through just this part.'),
  opacity: z.number().optional().describe('Opacity of just this part, 0-1, e.g. to de-emphasize a word.'),
})

export const highlightsSchema = z
  .array(textHighlightSchema)
  .optional()
  .describe(
    'Style parts of the text differently from the rest: accent-colored key words, highlight pills, mixed bold/italic. Each entry must be an exact substring of the text. Pass [] to remove all part-level styling. Whenever you change `text` without passing highlights, existing highlights are cleared.',
  )

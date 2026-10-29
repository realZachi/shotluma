import type { ShapeElement } from './types'

export const shapeCatalog: {
  id: ShapeElement['shape']
  label: string
  group: 'Base' | 'Accent' | 'Lines'
}[] = [
  { id: 'circle', label: 'Circle', group: 'Base' },
  { id: 'square', label: 'Square', group: 'Base' },
  { id: 'rounded-square', label: 'Soft square', group: 'Base' },
  { id: 'pill', label: 'Pill', group: 'Base' },
  { id: 'triangle', label: 'Triangle', group: 'Base' },
  { id: 'diamond', label: 'Diamond', group: 'Base' },
  { id: 'star', label: 'Star', group: 'Accent' },
  { id: 'burst', label: 'Burst', group: 'Accent' },
  { id: 'spark', label: 'Spark', group: 'Accent' },
  { id: 'blob', label: 'Blob', group: 'Accent' },
  { id: 'arch', label: 'Arch', group: 'Accent' },
  { id: 'ring', label: 'Ring', group: 'Accent' },
  { id: 'line', label: 'Line', group: 'Lines' },
  { id: 'arrow', label: 'Arrow', group: 'Lines' },
  { id: 'wave', label: 'Wave', group: 'Lines' },
]

// `ShapeGraphic` draws these as a single colored line with no fill, so their
// visible color comes from `color` (the toolbar's "Fill"/"Color" swatch) —
// `strokeColor` is never read for them. The toolbar must not offer a separate
// "Stroke" color control for these shapes; it would silently do nothing.
export const strokeOnlyShapes: ReadonlySet<ShapeElement['shape']> = new Set(['ring', 'line', 'arrow', 'wave'])

export const shapeAspectRatio: Record<ShapeElement['shape'], number> = {
  circle: 1,
  square: 1,
  'rounded-square': 1,
  pill: 3.2,
  triangle: 1,
  diamond: 1,
  star: 1,
  burst: 1,
  spark: 1,
  blob: 1,
  arch: 1,
  ring: 1,
  line: 4,
  arrow: 2.4,
  wave: 3.2,
}

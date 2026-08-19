export type ToolId = 'templates' | 'device' | 'elements' | 'text' | 'background' | 'uploads' | 'icons'

export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves'

export type Background = {
  type: 'solid' | 'gradient' | 'image'
  color1: string
  color2: string
  angle: number
  gradientKind?: 'linear' | 'radial'
  image?: string
  imageFit?: 'cover' | 'contain'
  imagePosition?: 'center' | 'top' | 'bottom'
  overlayColor?: string
  overlayOpacity?: number
  pattern?: BackgroundPattern
  patternColor?: string
  patternOpacity?: number
  patternScale?: number
}

export type BaseElement = {
  id: string
  x: number
  y: number
  width: number
  rotation: number
  opacity: number
  locked?: boolean
}

export type TextElement = BaseElement & {
  type: 'text'
  text: string
  html?: string
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  textTransform?: 'none' | 'uppercase' | 'lowercase'
  backgroundColor?: string
  backgroundOpacity?: number
  padding?: number
  borderRadius?: number
  strokeColor?: string
  strokeWidth?: number
  shadow?: number
  shadowColor?: string
}

export type DeviceElement = BaseElement & {
  type: 'device'
  deviceStyle:
    | 'iphone-17-a'
    | 'iphone-17-b'
    | 'iphone-17-c'
    | 'iphone-17-d'
    | 'iphone-17-e'
    | 'iphone-17-f'
    | 'tilted-hand'
  screenshot?: string
  screenTheme: 'coral' | 'mint' | 'night' | 'sun'
  tiltX: number
  tiltY: number
  shadow: number
  /** Render a continuation of this mockup on adjacent screens so it straddles the boundary. */
  spansScreens?: boolean
}

export type ImageElement = BaseElement & {
  type: 'image'
  src: string
  borderRadius: number
  shadow?: number
}

export type ShapeElement = BaseElement & {
  type: 'shape'
  shape:
    | 'circle'
    | 'square'
    | 'rounded-square'
    | 'pill'
    | 'triangle'
    | 'diamond'
    | 'star'
    | 'burst'
    | 'spark'
    | 'blob'
    | 'arch'
    | 'ring'
    | 'line'
    | 'arrow'
    | 'wave'
  color: string
  strokeColor?: string
  strokeWidth?: number
  shadow?: number
}

export type IconElement = BaseElement & {
  type: 'icon'
  icon: string
  color: string
  strokeWidth?: number
  shadow?: number
}

export type CanvasElement = TextElement | DeviceElement | ImageElement | ShapeElement | IconElement

export type Slide = {
  id: string
  name: string
  background: Background
  elements: CanvasElement[]
  /**
   * Sanitized AI-authored screen markup. When set, the artboard renders this
   * HTML document (authored at 1290 × 2796 px) instead of background and
   * elements, and the screen is editable only through AI runs.
   */
  html?: string
}

export type UploadAsset = {
  id: string
  name: string
  /**
   * Renderable source. At runtime this is an object URL for a Blob in the
   * IndexedDB asset store (data URL only when Blob storage is unavailable);
   * persisted documents carry `blob-asset:` references instead.
   */
  src: string
}

export type TemplateId = 'ink' | 'paper' | 'lime' | 'coral'

export type TextPreset = 'title' | 'subtitle' | 'body' | 'label' | 'quote' | 'stat'

import { uid } from './utils'
import type { CanvasElement, Slide, TemplateId } from './types'

const text = (
  value: string,
  [x, y, width, fontSize, color]: [
    x: number,
    y: number,
    width: number,
    fontSize: number,
    color: string,
  ],
  options: Partial<Extract<CanvasElement, { type: 'text' }>> = {},
): Extract<CanvasElement, { type: 'text' }> => ({
  id: uid('text'),
  type: 'text',
  x,
  y,
  width,
  rotation: 0,
  opacity: 1,
  text: value,
  color,
  fontFamily: 'Bricolage Grotesque Variable',
  fontSize,
  fontWeight: 750,
  align: 'left',
  lineHeight: 0.94,
  letterSpacing: -1.4,
  italic: false,
  underline: false,
  strikethrough: false,
  textTransform: 'none',
  backgroundColor: '#ffffff',
  backgroundOpacity: 0,
  padding: 0,
  borderRadius: 0,
  strokeColor: '#111116',
  strokeWidth: 0,
  shadow: 0,
  shadowColor: '#000000',
  ...options,
})

const device = (
  [x, y, width, rotation, screenTheme, style = 'iphone-17-a']: [
    x: number,
    y: number,
    width: number,
    rotation: number,
    screenTheme: Extract<CanvasElement, { type: 'device' }>['screenTheme'],
    style?: Extract<CanvasElement, { type: 'device' }>['deviceStyle'],
  ],
  extra: Partial<Extract<CanvasElement, { type: 'device' }>> = {},
): Extract<CanvasElement, { type: 'device' }> => ({
  id: uid('device'),
  type: 'device',
  x,
  y,
  width,
  rotation,
  opacity: 1,
  deviceStyle: style,
  screenTheme,
  tiltX: 0,
  tiltY: 0,
  shadow: 60,
  ...extra,
})

const shape = (
  kind: Extract<CanvasElement, { type: 'shape' }>['shape'],
  [x, y, width, color, rotation = 0]: [
    x: number,
    y: number,
    width: number,
    color: string,
    rotation?: number,
  ],
): Extract<CanvasElement, { type: 'shape' }> => ({
  id: uid('shape'),
  type: 'shape',
  x,
  y,
  width,
  rotation,
  opacity: 1,
  shape: kind,
  color,
  strokeColor: '#171713',
  strokeWidth: 0,
  shadow: 10,
})

export const makeTemplate = (template: TemplateId, name = 'Screen'): Slide => {
  if (template === 'paper') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'solid', color1: '#f2eee5', color2: '#f2eee5', angle: 130 },
      elements: [
        text('Your best work,\nbeautifully\nframed.', [7, 6.4, 86, 35, '#26221d'], { align: 'center', lineHeight: 0.92 }),
        text('Polished screenshots without the design bottleneck.', [15, 22.5, 70, 14, '#777064'], {
          align: 'center',
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 540,
          lineHeight: 1.25,
          letterSpacing: -0.2,
        }),
        shape('pill', [11, 33, 78, '#ded7c8', -3]),
        device([20, 31, 60, 0, 'mint', 'iphone-17-a'], { shadow: 45 }),
        shape('spark', [10, 67, 13, '#ff5a36', -8]),
        text('READY FOR REVIEW', [53, 91.5, 39, 9, '#777064'], {
          align: 'right',
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.5,
          lineHeight: 1,
        }),
      ],
    }
  }

  if (template === 'lime') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'solid', color1: '#d8ff55', color2: '#d8ff55', angle: 115 },
      elements: [
        text('Launch-ready.\nRight on time.', [7, 6.5, 86, 38, '#172015'], { lineHeight: 0.91 }),
        text('04 / EXPORT', [68, 22.4, 24, 9, '#172015'], {
          align: 'right',
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.1,
          lineHeight: 1,
        }),
        device([-4, 34, 59, 0, 'sun', 'iphone-17-a'], { shadow: 44 }),
        device([45, 32, 59, 0, 'coral', 'iphone-17-b'], { shadow: 48 }),
        shape('circle', [9, 79, 17, '#172015']),
        text('ALL\nSCREENS', [11.2, 81.3, 12.5, 8, '#d8ff55'], {
          align: 'center',
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 800,
          letterSpacing: 0.5,
          lineHeight: 0.98,
        }),
      ],
    }
  }

  if (template === 'coral') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'gradient', color1: '#ff6b4a', color2: '#ffb171', angle: 145 },
      elements: [
        text('One canvas.\nEvery story.', [8, 7, 84, 43, '#2c1612'], { lineHeight: 0.91 }),
        text('Create. Arrange. Export.', [8.5, 22, 65, 15, '#7e2f21'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 580,
          letterSpacing: -0.3,
          lineHeight: 1,
        }),
        shape('circle', [71, 29, 20, '#ffe3b3']),
        device([1, 39, 98, 0, 'night', 'iphone-17-e'], { shadow: 56 }),
        text('PNG', [8, 86.4, 30, 31, '#2c1612'], { fontWeight: 830, lineHeight: 1 }),
        text('x ALL', [38, 89.1, 29, 12, '#7e2f21'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 700,
          letterSpacing: 0,
          lineHeight: 1,
        }),
      ],
    }
  }

  if (template === 'slate') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'gradient', color1: '#1e293b', color2: '#0f172a', angle: 145 },
      elements: [
        text('Designed for\ntablet power.', [8, 6.8, 84, 40, '#f8fafc'], { lineHeight: 0.93 }),
        text('Experience the full desktop dashboard in your hands.', [8.5, 19.8, 80, 14, '#94a3b8'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 540,
          letterSpacing: -0.2,
          lineHeight: 1.25,
        }),
        shape('pill', [8, 29, 32, '#0284c7']),
        text('PRO WORKSPACE', [11, 30.5, 26, 8, '#ffffff'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 750,
          letterSpacing: 1,
          lineHeight: 1,
        }),
        device([12, 36, 76, 0, 'night', 'ipad-pro-portrait'], { shadow: 62 }),
        text('IPAD & TABLET READY', [8, 92, 50, 9, '#64748b'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.2,
          lineHeight: 1,
        }),
      ],
    }
  }

  if (template === 'cyber') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'solid', color1: '#09090b', color2: '#09090b', angle: 135 },
      elements: [
        text('Pure speed.\nZero friction.', [8, 6.8, 84, 42, '#ffffff'], { lineHeight: 0.92 }),
        text('Optimized for modern Android performance.', [8.5, 20.5, 78, 14, '#a1a1aa'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 540,
          letterSpacing: -0.2,
          lineHeight: 1.25,
        }),
        shape('circle', [74, 27, 16, '#10b981']),
        device([17, 30, 66, 0, 'mint', 'android-phone'], { shadow: 58 }),
        text('01 / GOOGLE PLAY', [8, 92, 45, 9, '#71717a'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.2,
          lineHeight: 1,
        }),
      ],
    }
  }

  if (template === 'split-tablet') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'gradient', color1: '#0b1120', color2: '#1e293b', angle: 135 },
      elements: [
        text('Desktop caliber.\nOn the go.', [8, 6.5, 84, 42, '#f8fafc'], { lineHeight: 0.92 }),
        text('Full multitasking workspace optimized for tablet workflows.', [8.5, 20.5, 78, 14, '#94a3b8'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 540,
          letterSpacing: -0.2,
          lineHeight: 1.25,
        }),
        shape('pill', [8, 29.5, 28, '#38bdf8']),
        text('LANDSCAPE STUDIO', [10.5, 31, 23, 8, '#082f49'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 800,
          letterSpacing: 0.8,
          lineHeight: 1,
        }),
        device([5, 38, 90, 0, 'night', 'ipad-pro-landscape'], { shadow: 65, cleanStatusBar: true }),
        text('IPAD & TABLET SUITE', [8, 92, 45, 9, '#64748b'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.2,
          lineHeight: 1,
        }),
      ],
    }
  }

  if (template === 'panoramic-duo') {
    return {
      id: uid('slide'),
      name,
      background: { type: 'gradient', color1: '#2e1065', color2: '#0f172a', angle: 140 },
      elements: [
        text('Seamless flow\nacross screens.', [8, 6.8, 84, 42, '#faf5ff'], { lineHeight: 0.92 }),
        text('Panoramic storytelling that connects continuous screenshots.', [8.5, 20.8, 78, 14, '#c084fc'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 540,
          letterSpacing: -0.2,
          lineHeight: 1.25,
        }),
        shape('circle', [76, 28, 18, '#f43f5e']),
        device([45, 32, 75, 0, 'coral', 'iphone-17-a'], { shadow: 60, spansScreens: true, cleanStatusBar: true }),
        text('02 / PANORAMA', [8, 92, 40, 9, '#a855f7'], {
          fontFamily: 'Instrument Sans Variable',
          fontWeight: 720,
          letterSpacing: 1.2,
          lineHeight: 1,
        }),
      ],
    }
  }

  return {
    id: uid('slide'),
    name,
    background: { type: 'gradient', color1: '#252435', color2: '#111116', angle: 155 },
    elements: [
      text('Build visuals\nthat sell.', [7, 6.4, 86, 45, '#f6f1e8']),
      text('Turn product moments into launch-ready stories.', [8, 21.2, 76, 15, '#b7b2c6'], {
        fontFamily: 'Instrument Sans Variable',
        fontWeight: 520,
        lineHeight: 1.22,
        letterSpacing: -0.2,
      }),
      shape('circle', [74, 29, 18, '#ff5a36']),
      shape('spark', [7, 40, 15, '#d8ff55', 8]),
      device([-2, 39, 104, 0, 'coral', 'iphone-17-f']),
      text('01 — PRODUCT', [8, 91.5, 45, 9, '#9e99ad'], {
        fontFamily: 'Instrument Sans Variable',
        fontWeight: 720,
        letterSpacing: 1.4,
        lineHeight: 1,
      }),
    ],
  }
}

/** New projects start empty so the editor empty state can guide first creation. */
export const createInitialSlides = (): Slide[] => []

export const templateMeta: { id: TemplateId; name: string; eyebrow: string }[] = [
  { id: 'ink', name: 'Midnight pitch', eyebrow: 'Bold / product' },
  { id: 'paper', name: 'Editorial calm', eyebrow: 'Soft / premium' },
  { id: 'lime', name: 'Electric launch', eyebrow: 'Bright / energetic' },
  { id: 'coral', name: 'Warm story', eyebrow: 'Color / lifestyle' },
  { id: 'slate', name: 'Tablet Pro', eyebrow: 'iPad / SaaS' },
  { id: 'cyber', name: 'Android Pulse', eyebrow: 'Modern / mobile' },
  { id: 'split-tablet', name: 'Studio Split', eyebrow: 'iPad landscape' },
  { id: 'panoramic-duo', name: 'Panoramic Seam', eyebrow: 'Multi-screen flow' },
]

export const fontOptions = [
  { name: 'Bricolage', value: 'Bricolage Grotesque Variable', category: 'Display' },
  { name: 'Syne', value: 'Syne Variable', category: 'Display' },
  { name: 'Bebas Neue', value: 'Bebas Neue', category: 'Display' },
  { name: 'Archivo Black', value: 'Archivo Black', category: 'Display' },
  { name: 'Anton', value: 'Anton', category: 'Display' },
  { name: 'Instrument Sans', value: 'Instrument Sans Variable', category: 'Sans' },
  { name: 'Manrope', value: 'Manrope Variable', category: 'Sans' },
  { name: 'Outfit', value: 'Outfit Variable', category: 'Sans' },
  { name: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans Variable', category: 'Sans' },
  { name: 'Sora', value: 'Sora Variable', category: 'Sans' },
  { name: 'Inter Tight', value: 'Inter Tight Variable', category: 'Sans' },
  { name: 'Fraunces', value: 'Fraunces', category: 'Serif' },
  { name: 'Playfair Display', value: 'Playfair Display', category: 'Serif' },
  { name: 'DM Serif Display', value: 'DM Serif Display', category: 'Serif' },
  { name: 'Libre Baskerville', value: 'Libre Baskerville', category: 'Serif' },
  { name: 'Cormorant Garamond', value: 'Cormorant Garamond', category: 'Serif' },
  { name: 'Space Mono', value: 'Space Mono', category: 'Mono' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono', category: 'Mono' },
  { name: 'Caveat', value: 'Caveat', category: 'Handwritten' },
  { name: 'Permanent Marker', value: 'Permanent Marker', category: 'Handwritten' },
  { name: 'System Sans', value: 'Arial, sans-serif', category: 'Sans' },
]

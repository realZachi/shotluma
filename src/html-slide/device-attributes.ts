import { photoMockups } from '../mockups/catalog'
import type { DeviceElement } from '../types'

const DEVICE_THEMES = ['coral', 'mint', 'night', 'sun'] as const

export type DevicePlaceholderAttributes = {
  mockup?: string | null
  screenshot?: string | null
  theme?: string | null
  shadow?: string | null
}

const isDeviceStyle = (value: string): value is DeviceElement['deviceStyle'] => value in photoMockups

const isDeviceTheme = (value: string): value is DeviceElement['screenTheme'] =>
  (DEVICE_THEMES as readonly string[]).includes(value)

/**
 * Builds the DeviceElement a `<shotluma-device>` placeholder renders as.
 * Position and size stay with the surrounding HTML/CSS; this element only
 * carries the mockup identity, so x/y/width are inert defaults.
 */
export const deviceElementFromAttributes = (
  attributes: DevicePlaceholderAttributes,
  index: number,
): DeviceElement => {
  const mockup = attributes.mockup ?? ''
  const theme = attributes.theme ?? ''
  const shadow = Number(attributes.shadow ?? '')
  // Only an already-resolved upload (data URL) may reach the screen; an
  // unresolved asset: reference or anything else falls back to the fake screen.
  const screenshot = attributes.screenshot?.startsWith('data:image/') ? attributes.screenshot : undefined

  return {
    id: `html-device-${index}`,
    type: 'device',
    x: 0,
    y: 0,
    width: 100,
    rotation: 0,
    opacity: 1,
    deviceStyle: isDeviceStyle(mockup) ? mockup : 'iphone-17-a',
    screenTheme: isDeviceTheme(theme) ? theme : 'night',
    tiltX: 0,
    tiltY: 0,
    shadow: Number.isFinite(shadow) ? Math.min(100, Math.max(0, shadow)) : 55,
    ...(screenshot ? { screenshot } : {}),
  }
}

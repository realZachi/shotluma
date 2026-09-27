import { describe, expect, it } from 'vitest'
import { deviceOptions, getDevicePlacement, photoMockups, type DeviceStyle } from './catalog'
import { createPerspectiveMapping } from './perspective'

describe('mockups catalog', () => {
  it('defines valid definitions for all device options', () => {
    expect(deviceOptions.length).toBeGreaterThanOrEqual(10)

    for (const option of deviceOptions) {
      expect(photoMockups[option.id]).toBeDefined()
      expect(option.label).toBeTruthy()
      expect(option.preview).toBeTruthy()
    }
  })

  it('includes new tablet and phone mockups', () => {
    const ids = deviceOptions.map((opt) => opt.id)
    expect(ids).toContain('ipad-pro-portrait')
    expect(ids).toContain('ipad-pro-landscape')
    expect(ids).toContain('android-phone')
  })

  it('has valid geometry and placement for every device style', () => {
    for (const [key, definition] of Object.entries(photoMockups)) {
      const style = key as DeviceStyle
      expect(definition.canvasAspectRatio).toBeGreaterThan(0)
      expect(definition.sourceAspectRatio).toBeGreaterThan(0)
      expect(definition.screenQuad).toHaveLength(4)

      for (const point of definition.screenQuad) {
        expect(typeof point.x).toBe('number')
        expect(typeof point.y).toBe('number')
        expect(Number.isFinite(point.x)).toBe(true)
        expect(Number.isFinite(point.y)).toBe(true)
      }

      const placement = getDevicePlacement(style)
      expect(placement).toEqual(definition.defaultPlacement)
      expect(placement.width).toBeGreaterThan(0)

      const mapping = createPerspectiveMapping({
        width: 600,
        height: 600 / definition.canvasAspectRatio,
        definition,
        hasScreenshot: true,
      })
      expect(mapping.transform).toContain('matrix3d(')
      expect(mapping.sourceWidth).toBeGreaterThan(0)
      expect(mapping.sourceHeight).toBeGreaterThan(0)
    }
  })
})

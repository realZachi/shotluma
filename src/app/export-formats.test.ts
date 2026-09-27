import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_FORMAT_ID,
  EXPORT_FORMATS,
  getScreenFormat,
} from './export-formats'

describe('EXPORT_FORMATS', () => {
  it('defines valid dimensions and orientations for all formats', () => {
    expect(EXPORT_FORMATS.length).toBeGreaterThanOrEqual(14)

    for (const format of EXPORT_FORMATS) {
      expect(format.id).toBeTypeOf('string')
      expect(format.label).toBeTypeOf('string')
      expect(format.shortLabel).toBeTypeOf('string')
      expect(['iphone', 'ipad', 'android']).toContain(format.category)
      expect(['portrait', 'landscape']).toContain(format.orientation)
      expect(format.width).toBeGreaterThan(0)
      expect(format.height).toBeGreaterThan(0)
      expect(format.editorWidth).toBeGreaterThan(0)
      expect(format.filename).toMatch(/^[A-Za-z0-9._-]+$/)

      if (format.orientation === 'portrait') {
        expect(format.height).toBeGreaterThan(format.width)
      } else {
        expect(format.width).toBeGreaterThan(format.height)
      }
    }
  })

  it('includes key official store screen dimensions', () => {
    const ids = new Set(EXPORT_FORMATS.map((f) => f.id))

    // iPhone sizes
    expect(ids.has('iphone-6.9')).toBe(true)
    expect(ids.has('iphone-6.5')).toBe(true)
    expect(ids.has('iphone-5.5')).toBe(true)

    // iPad Pro & Air sizes
    expect(ids.has('ipad-13')).toBe(true)
    expect(ids.has('ipad-13-landscape')).toBe(true)
    expect(ids.has('ipad-11')).toBe(true)
    expect(ids.has('ipad-11-landscape')).toBe(true)
    expect(ids.has('ipad-10')).toBe(true)
    expect(ids.has('ipad-10-landscape')).toBe(true)

    // Android sizes
    expect(ids.has('android-phone')).toBe(true)
    expect(ids.has('android-tablet-10-landscape')).toBe(true)
    expect(ids.has('android-tablet-10-portrait')).toBe(true)
    expect(ids.has('android-tablet-7-landscape')).toBe(true)
    expect(ids.has('android-tablet-7-portrait')).toBe(true)

    const ipad13 = getScreenFormat('ipad-13')
    expect(ipad13.width).toBe(2064)
    expect(ipad13.height).toBe(2752)

    const ipad13Landscape = getScreenFormat('ipad-13-landscape')
    expect(ipad13Landscape.width).toBe(2752)
    expect(ipad13Landscape.height).toBe(2064)

    const tablet10 = getScreenFormat('android-tablet-10-landscape')
    expect(tablet10.width).toBe(2560)
    expect(tablet10.height).toBe(1600)
  })
})

describe('getScreenFormat', () => {
  it('returns the requested format by id', () => {
    const format = getScreenFormat('ipad-11')
    expect(format.id).toBe('ipad-11')
    expect(format.width).toBe(1668)
    expect(format.height).toBe(2388)
  })

  it('falls back to default format when id is unknown or empty', () => {
    const fallback = getScreenFormat('unknown-device')
    expect(fallback.id).toBe(DEFAULT_CANVAS_FORMAT_ID)

    const nullFallback = getScreenFormat(null)
    expect(nullFallback.id).toBe(DEFAULT_CANVAS_FORMAT_ID)
  })
})

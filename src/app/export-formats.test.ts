import { describe, expect, it } from 'vitest'
import { EXPORT_FORMATS } from './export-formats'

// The reference aspect ratio shared by every Dynamic Island / Face ID iPhone
// screenshot size (App Store Connect's "9:19.5"-ish display family). Formats
// outside this tolerance would reflow the artboard into a visibly different
// shape instead of just changing resolution.
const REFERENCE_ASPECT_RATIO = 1290 / 2796
const ASPECT_RATIO_TOLERANCE = 0.01

describe('EXPORT_FORMATS', () => {
  it('has a unique id and filename for every format', () => {
    const ids = EXPORT_FORMATS.map((format) => format.id)
    const filenames = EXPORT_FORMATS.map((format) => format.filename)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(filenames).size).toBe(filenames.length)
  })

  it('only defines positive integer pixel dimensions', () => {
    for (const format of EXPORT_FORMATS) {
      expect(Number.isInteger(format.width)).toBe(true)
      expect(Number.isInteger(format.height)).toBe(true)
      expect(format.width).toBeGreaterThan(0)
      expect(format.height).toBeGreaterThan(0)
    }
  })

  it('keeps every format within the portrait aspect ratio family the artboard supports', () => {
    for (const format of EXPORT_FORMATS) {
      const ratio = format.width / format.height
      expect(Math.abs(ratio - REFERENCE_ASPECT_RATIO)).toBeLessThan(ASPECT_RATIO_TOLERANCE)
    }
  })

  it('includes the accepted App Store Connect size for iPhone with Dynamic Island (medium display)', () => {
    const format = EXPORT_FORMATS.find((candidate) => candidate.id === 'iphone-6.1')
    expect(format?.width).toBe(1179)
    expect(format?.height).toBe(2556)
  })

  it('includes the accepted App Store Connect size for iPhone with Face ID (medium display)', () => {
    const format = EXPORT_FORMATS.find((candidate) => candidate.id === 'iphone-5.8')
    expect(format?.width).toBe(1170)
    expect(format?.height).toBe(2532)
  })
})

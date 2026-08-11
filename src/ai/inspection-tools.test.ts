import { describe, expect, it } from 'vitest'
import { PREVIEW_LIMITS, reservePreviewAttempt } from './inspection-tools'

describe('preview budget', () => {
  it('allows one composition check plus two repair checks in generate mode', () => {
    const counts = new Map<string, number>()

    expect(reservePreviewAttempt(counts, 'slide-1', PREVIEW_LIMITS.generate)).toBe(true)
    expect(reservePreviewAttempt(counts, 'slide-1', PREVIEW_LIMITS.generate)).toBe(true)
    expect(reservePreviewAttempt(counts, 'slide-1', PREVIEW_LIMITS.generate)).toBe(true)
    expect(reservePreviewAttempt(counts, 'slide-1', PREVIEW_LIMITS.generate)).toBe(false)
  })

  it('tracks each slide independently and reserves an edit before/after budget', () => {
    const counts = new Map<string, number>()

    for (let index = 0; index < PREVIEW_LIMITS.edit; index += 1) {
      expect(reservePreviewAttempt(counts, 'target', PREVIEW_LIMITS.edit)).toBe(true)
    }
    expect(reservePreviewAttempt(counts, 'target', PREVIEW_LIMITS.edit)).toBe(false)
    expect(reservePreviewAttempt(counts, 'other', PREVIEW_LIMITS.edit)).toBe(true)
  })
})

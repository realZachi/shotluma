import { describe, expect, it } from 'vitest'
import { warningsForElement } from './tool-context'

describe('warningsForElement', () => {
  it('keeps only warnings affected by the current mutation', () => {
    const warnings = [
      'Text text-1 overflows the right canvas edge by 2.0%.',
      'Text text-2 overlaps device device-1 by 25.0% of the smaller element.',
      'Text text-3 overlaps device device-2 by 30.0% of the smaller element.',
    ]

    expect(warningsForElement(warnings, 'device-1')).toEqual([warnings[1]])
    expect(warningsForElement(warnings, 'text-1')).toEqual([warnings[0]])
  })

  it('returns an empty list instead of repeating unrelated slide warnings', () => {
    expect(warningsForElement(['Text text-1 overflows the canvas.'], 'shape-1')).toEqual([])
  })
})

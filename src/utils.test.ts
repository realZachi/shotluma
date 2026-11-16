import { describe, expect, it } from 'vitest'
import { richTextToPlain, sanitizeRichText } from './utils'

describe('sanitizeRichText', () => {
  it('preserves line breaks followed by plain text', () => {
    const sanitized = sanitizeRichText('Track your<br> fuel, trips, services')

    expect(sanitized).toBe('Track your<br> fuel, trips, services')
    expect(richTextToPlain(sanitized)).toBe('Track your\n fuel, trips, services')
  })

  it('preserves block line breaks produced by contenteditable Enter', () => {
    const sanitized = sanitizeRichText('Track your<div> fuel, trips, services</div>')

    expect(sanitized).toBe('Track your<br> fuel, trips, services')
    expect(richTextToPlain(sanitized)).toBe('Track your\n fuel, trips, services')
  })

  it('strips trailing br elements at the end of the text', () => {
    expect(sanitizeRichText('Track your<br><br>')).toBe('Track your')
  })
})

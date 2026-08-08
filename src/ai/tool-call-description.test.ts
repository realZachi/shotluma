import { describe, expect, it } from 'vitest'
import { describeAiToolCall } from './tool-call-description'

describe('describeAiToolCall', () => {
  it('does not resolve inherited object properties as static tool descriptions', () => {
    expect(describeAiToolCall('constructor', {})).toBe('Tool: constructor')
    expect(describeAiToolCall('toString', {})).toBe('Tool: toString')
  })
})

import { describe, expect, it } from 'vitest'
import {
  OPENCODE_SESSION_ID,
  opencodeBaseUrl,
  opencodeRequestHeaders,
} from './opencode-client'
import { opencodeRequestModelId } from './opencode-models'

describe('OpenCode client routing', () => {
  it('builds same-origin proxy base URLs for Zen and Go', () => {
    expect(opencodeBaseUrl('opencode-zen', 'https://app.shotluma.com'))
      .toBe('https://app.shotluma.com/api/opencode/zen/v1')
    expect(opencodeBaseUrl('opencode-go', 'http://127.0.0.1:4173'))
      .toBe('http://127.0.0.1:4173/api/opencode/go/v1')
  })

  it('sends the upstream model id rather than the catalog prefix', () => {
    expect(opencodeRequestModelId('opencode-go/glm-5.3', 'glm-5.3')).toBe('glm-5.3')
    expect(opencodeRequestModelId('opencode-zen/kimi-k3')).toBe('kimi-k3')
  })

  it('identifies every request with a stable session header', () => {
    const headers = opencodeRequestHeaders()
    expect(headers['x-opencode-session']).toBe(OPENCODE_SESSION_ID)
    expect(opencodeRequestHeaders()['x-opencode-session']).toBe(OPENCODE_SESSION_ID)
  })
})

import { describe, expect, it } from 'vitest'
import {
  OPENCODE_SESSION_ID,
  OPENCODE_SESSION_STORAGE_KEY,
  opencodeBaseUrl,
  opencodeRequestHeaders,
  readOpencodeSessionId,
} from './opencode-client'
import { opencodeRequestModelId } from './opencode-models'

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial))
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
  }
}

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

  it('reuses a stored session id so it survives a full page reload', () => {
    const storage = createMemoryStorage({ [OPENCODE_SESSION_STORAGE_KEY]: 'shotluma-stored' })
    expect(readOpencodeSessionId(storage)).toBe('shotluma-stored')
  })

  it('generates and persists a session id when storage is empty', () => {
    const storage = createMemoryStorage()
    const generated = readOpencodeSessionId(storage)
    expect(generated).toMatch(/^shotluma-/u)
    expect(storage.entries.get(OPENCODE_SESSION_STORAGE_KEY)).toBe(generated)
    expect(readOpencodeSessionId(storage)).toBe(generated)
  })

  it('falls back to a per-page-load id when storage is unavailable', () => {
    expect(readOpencodeSessionId(null)).toMatch(/^shotluma-/u)
    expect(readOpencodeSessionId(null)).not.toBe(readOpencodeSessionId(null))
  })
})

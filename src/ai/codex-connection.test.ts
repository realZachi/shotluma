import { describe, expect, it } from 'vitest'
import {
  CODEX_CONNECTION_STORAGE_KEY,
  buildCodexDesktopDeepLink,
  buildCodexSetupPrompt,
  createCodexConnection,
  createCodexPairingToken,
  normalizeCodexAppOrigin,
  parseCodexConnection,
  readCodexConnection,
  removeCodexConnection,
  writeCodexConnection,
} from './codex-connection'

const createRandomSource = (fill: number) => ({
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint8Array) array.fill(fill)
    return array
  },
})

const createMemoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('Codex connection setup', () => {
  it('creates a 256-bit base64url pairing token', () => {
    const token = createCodexPairingToken(createRandomSource(255))
    expect(token).toHaveLength(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('normalizes safe browser origins and rejects other protocols', () => {
    expect(normalizeCodexAppOrigin('https://app.shotluma.com/setup?x=1')).toBe(
      'https://app.shotluma.com',
    )
    expect(normalizeCodexAppOrigin('http://127.0.0.1:4173/path')).toBe(
      'http://127.0.0.1:4173',
    )
    expect(normalizeCodexAppOrigin('http://studio.localhost:4173/path')).toBe(
      'http://studio.localhost:4173',
    )
    expect(normalizeCodexAppOrigin('http://app.shotluma.com')).toBeNull()
    expect(normalizeCodexAppOrigin('http://192.168.1.4:4173')).toBeNull()
    expect(normalizeCodexAppOrigin('file:///tmp/shotluma')).toBeNull()
    expect(normalizeCodexAppOrigin('https://user:pass@example.com')).toBeNull()
  })

  it('persists only valid versioned connection records', () => {
    const storage = createMemoryStorage()
    const connection = createCodexConnection({
      appOrigin: 'https://app.shotluma.com',
      randomSource: createRandomSource(7),
    })
    expect(writeCodexConnection(connection, storage)).toBe(true)
    expect(readCodexConnection(storage)).toEqual(connection)
    expect(parseCodexConnection(JSON.stringify({ ...connection, version: 2 }))).toBeNull()
    expect(parseCodexConnection(JSON.stringify({ ...connection, pairingToken: 'short' }))).toBeNull()
    expect(removeCodexConnection(storage)).toBe(true)
    expect(storage.getItem(CODEX_CONNECTION_STORAGE_KEY)).toBeNull()
  })

  it('builds a transparent no-sudo setup prompt without embedding auth tokens', () => {
    const connection = createCodexConnection({
      appOrigin: 'https://app.shotluma.com',
      randomSource: createRandomSource(12),
    })
    const prompt = buildCodexSetupPrompt(connection)
    expect(prompt).toContain(connection.pairingToken)
    expect(prompt).toContain('https://app.shotluma.com')
    expect(prompt).toContain('https://app.shotluma.com/codex/shotluma-codex-bridge.mjs')
    expect(prompt).toContain('without sudo')
    expect(prompt).toContain('never reads `~/.codex/auth.json`')
    expect(prompt).toContain('`<RUNTIME>`')
    expect(prompt).toContain('<RUNTIME> ~/.local/share/shotluma/shotluma-codex-bridge.mjs')
    expect(prompt).not.toContain('`node ~/.local/share/shotluma/shotluma-codex-bridge.mjs')
    expect(prompt).not.toContain('OPENAI_API_KEY')
  })

  it('explicitly permits HTTP only for a loopback development source', () => {
    const connection = createCodexConnection({
      appOrigin: 'http://127.0.0.1:4174',
      randomSource: createRandomSource(15),
    })
    const prompt = buildCodexSetupPrompt(connection)
    expect(prompt).toContain(
      'Official bridge source: http://127.0.0.1:4174/codex/shotluma-codex-bridge.mjs',
    )
    expect(prompt).toContain('explicitly authorized')
    expect(prompt).toContain('Do not rewrite the URL to HTTPS')
    expect(prompt).toContain('HTTP exception applies only to this 127.0.0.1/localhost source')
  })

  it('builds an official ChatGPT desktop deep link with the setup prompt', () => {
    const connection = createCodexConnection({
      appOrigin: 'https://app.shotluma.com',
      randomSource: createRandomSource(18),
    })
    const deepLink = buildCodexDesktopDeepLink(connection)
    const parsed = new URL(deepLink)

    expect(parsed.protocol).toBe('codex:')
    expect(parsed.hostname).toBe('threads')
    expect(parsed.pathname).toBe('/new')
    expect(parsed.searchParams.get('prompt')).toBe(buildCodexSetupPrompt(connection))
  })
})

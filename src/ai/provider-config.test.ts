import { afterEach, describe, expect, it } from 'vitest'
import {
  AI_PROVIDER_KEYS_STORAGE_KEY,
  createAiProviderKeys,
  createEmptyAiProviderKeys,
  getAiProviderAvailability,
  getAiProviderTransportAvailability,
  getInitialAiSelection,
  getResolvedAiProviderKeys,
  getResolvedAiProviderAvailability,
  isLocalAiProxyHostname,
  mergeAiProviderKeys,
  parseStoredAiProviderKeys,
  readStoredAiProviderKeys,
  serializeStoredAiProviderKeys,
  writeStoredAiProviderKeys,
} from './provider-config'

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

describe('AI provider configuration', () => {
  afterEach(() => {
    localStorage.removeItem(AI_PROVIDER_KEYS_STORAGE_KEY)
  })

  it('reads and trims public keys from the local Vite environment', () => {
    expect(createAiProviderKeys({
      VITE_MOONSHOT_API_KEY: ' moonshot-key ',
      VITE_GOOGLE_GENERATIVE_AI_API_KEY: ' google-key ',
      VITE_ALIBABA_API_KEY: 'qwen-key',
      VITE_OPENAI_API_KEY: 'openai-key',
      VITE_ANTHROPIC_API_KEY: 'anthropic-key',
      VITE_XAI_API_KEY: ' xai-key ',
      VITE_OPENROUTER_API_KEY: ' openrouter-key ',
    })).toEqual({
      codex: '',
      moonshot: 'moonshot-key',
      google: 'google-key',
      qwen: 'qwen-key',
      openai: 'openai-key',
      anthropic: 'anthropic-key',
      xai: 'xai-key',
      openrouter: 'openrouter-key',
    })
  })

  it('treats missing, blank, and non-string values as unconfigured', () => {
    const keys = createAiProviderKeys({
      VITE_GOOGLE_GENERATIVE_AI_API_KEY: ' ',
      VITE_ALIBABA_API_KEY: true,
      VITE_OPENAI_API_KEY: 'openai-key',
    })

    expect(keys).toEqual({
      codex: '',
      moonshot: '',
      google: '',
      qwen: '',
      openai: 'openai-key',
      anthropic: '',
      xai: '',
      openrouter: '',
    })
    expect(getAiProviderAvailability(keys)).toEqual({
      codex: false,
      moonshot: false,
      google: false,
      qwen: false,
      openai: true,
      anthropic: false,
      xai: false,
      openrouter: false,
    })
  })

  it('starts with the first configured provider and otherwise offers the Codex connection', () => {
    expect(getInitialAiSelection({
      codex: false,
      moonshot: false,
      google: false,
      qwen: false,
      openai: true,
      anthropic: true,
      xai: true,
      openrouter: true,
    })).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-terra',
      reasoningEffort: 'high',
    })
    expect(getInitialAiSelection({
      codex: false,
      moonshot: false,
      google: false,
      qwen: false,
      openai: false,
      anthropic: false,
      xai: false,
      openrouter: true,
    })).toEqual({
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-5',
      reasoningEffort: 'high',
    })
    expect(getInitialAiSelection({
      codex: false,
      moonshot: false,
      google: false,
      qwen: false,
      openai: false,
      anthropic: false,
      xai: false,
      openrouter: false,
    })).toEqual({
      provider: 'codex',
      model: 'codex/gpt-5.6-terra',
      reasoningEffort: 'high',
    })
    expect(getInitialAiSelection({
      codex: false,
      moonshot: true,
      google: true,
      qwen: false,
      openai: false,
      anthropic: false,
      xai: false,
      openrouter: false,
    })).toEqual({
      provider: 'moonshot',
      model: 'kimi-k3',
      reasoningEffort: 'high',
    })
  })

  it('prefers browser-stored keys over environment keys', () => {
    const environment = createAiProviderKeys({
      VITE_OPENAI_API_KEY: 'env-openai',
      VITE_GOOGLE_GENERATIVE_AI_API_KEY: 'env-google',
    })
    const stored = {
      ...createEmptyAiProviderKeys(),
      openai: 'browser-openai',
    }

    expect(mergeAiProviderKeys(environment, stored)).toEqual({
      codex: '',
      moonshot: '',
      google: 'env-google',
      qwen: '',
      openai: 'browser-openai',
      anthropic: '',
      xai: '',
      openrouter: '',
    })
  })

  it('parses, serializes, and persists only non-empty browser keys', () => {
    expect(parseStoredAiProviderKeys(null)).toEqual(createEmptyAiProviderKeys())
    expect(parseStoredAiProviderKeys('{not-json')).toEqual(createEmptyAiProviderKeys())
    expect(parseStoredAiProviderKeys(JSON.stringify({
      openai: ' sk-test ',
      ignored: 'nope',
      google: '',
    }))).toEqual({
      ...createEmptyAiProviderKeys(),
      openai: 'sk-test',
    })

    const storage = createMemoryStorage()
    expect(writeStoredAiProviderKeys({
      ...createEmptyAiProviderKeys(),
      anthropic: 'claude-key',
      openai: '  ',
    }, storage)).toEqual({ ok: true })

    expect(storage.getItem(AI_PROVIDER_KEYS_STORAGE_KEY)).toBe(
      serializeStoredAiProviderKeys({
        ...createEmptyAiProviderKeys(),
        anthropic: 'claude-key',
      }),
    )
    expect(readStoredAiProviderKeys(storage)).toEqual({
      ...createEmptyAiProviderKeys(),
      anthropic: 'claude-key',
    })

    expect(writeStoredAiProviderKeys(createEmptyAiProviderKeys(), storage)).toEqual({ ok: true })
    expect(storage.getItem(AI_PROVIDER_KEYS_STORAGE_KEY)).toBeNull()
  })

  it('resolves keys from browser storage when present', () => {
    const storage = createMemoryStorage({
      [AI_PROVIDER_KEYS_STORAGE_KEY]: JSON.stringify({ xai: 'grok-key' }),
    })

    expect(getResolvedAiProviderKeys(storage).xai).toBe('grok-key')
  })

  it('reports browser storage failures instead of claiming that keys were saved', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
      removeItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
    }

    expect(writeStoredAiProviderKeys({
      ...createEmptyAiProviderKeys(),
      openai: 'openai-key',
    }, throwingStorage)).toEqual({
      ok: false,
      error: 'The browser blocked local storage. The previous API keys were left unchanged.',
    })
    expect(writeStoredAiProviderKeys(createEmptyAiProviderKeys(), null)).toEqual({
      ok: false,
      error: 'Browser storage is unavailable. The API keys were not saved.',
    })
  })

  it('allows the Moonshot proxy only on local browser hosts', () => {
    expect(isLocalAiProxyHostname('localhost')).toBe(true)
    expect(isLocalAiProxyHostname('studio.localhost.')).toBe(true)
    expect(isLocalAiProxyHostname('127.0.0.1')).toBe(true)
    expect(isLocalAiProxyHostname('[::1]')).toBe(true)
    expect(isLocalAiProxyHostname('app.shotluma.com')).toBe(false)
    expect(getAiProviderTransportAvailability('app.shotluma.com').moonshot).toBe(false)
  })

  it('does not mark a stored Moonshot key as usable without the local proxy', () => {
    const storage = createMemoryStorage({
      [AI_PROVIDER_KEYS_STORAGE_KEY]: JSON.stringify({ moonshot: 'moonshot-key' }),
    })

    expect(getResolvedAiProviderAvailability(storage, 'app.shotluma.com').moonshot).toBe(false)
    expect(getResolvedAiProviderAvailability(storage, '127.0.0.1').moonshot).toBe(true)
  })
})

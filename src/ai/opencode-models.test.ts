import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatOpencodeModelLabel,
  loadAllOpencodeModels,
  loadOpencodeModels,
  opencodeCatalogId,
  opencodeModelsUrl,
  opencodeModelSupportsVision,
  parseOpencodeModels,
  pickOpencodeVisionModel,
  readCachedOpencodeModels,
  toOpencodeModelOption,
} from './opencode-models'
import {
  getAiProvider,
  getDynamicProviderModels,
  setDynamicProviderModels,
} from './provider-catalog'

const createMemoryStorage = (entries: Record<string, string> = {}) => {
  const store = new Map(Object.entries(entries))
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

afterEach(() => {
  setDynamicProviderModels('opencode-zen', [])
  setDynamicProviderModels('opencode-go', [])
  vi.unstubAllGlobals()
})

describe('OpenCode model catalog', () => {
  it('formats labels and marks known text-only models', () => {
    expect(formatOpencodeModelLabel('gpt-5.6-luna')).toBe('GPT 5.6 Luna')
    expect(formatOpencodeModelLabel('kimi-k3')).toBe('Kimi K3')
    expect(formatOpencodeModelLabel('mimo-v2.5-pro')).toBe('MiMo V2.5 Pro')
    expect(formatOpencodeModelLabel('big-pickle')).toBe('Big Pickle')
    expect(opencodeModelSupportsVision('kimi-k3')).toBe(true)
    expect(opencodeModelSupportsVision('glm-5.3')).toBe(false)
    expect(opencodeCatalogId('opencode-go', 'glm-5.3')).toBe('opencode-go/glm-5.3')
  })

  it('parses the live /models list and keeps text-only tool models', () => {
    const models = parseOpencodeModels('opencode-go', {
      data: [
        { id: 'glm-5.3' },
        { id: 'kimi-k3' },
        { id: 'kimi-k3' },
        { id: '' },
        'nope',
      ],
    })
    expect(models.map((model) => model.id)).toEqual([
      'opencode-go/glm-5.3',
      'opencode-go/kimi-k3',
    ])
    expect(toOpencodeModelOption('opencode-go', 'glm-5.3')).toMatchObject({
      providerModelId: 'glm-5.3',
      supportsVision: false,
      reasoningEfforts: ['low', 'medium', 'high'],
    })
    expect(toOpencodeModelOption('opencode-zen', 'kimi-k3').supportsVision).toBeUndefined()
    expect(parseOpencodeModels('opencode-zen', null)).toEqual([])
  })

  it('picks a cheap vision fallback and honors an explicit preference', () => {
    const models = [
      toOpencodeModelOption('opencode-zen', 'glm-5.2'),
      toOpencodeModelOption('opencode-zen', 'gpt-5-nano'),
      toOpencodeModelOption('opencode-zen', 'claude-sonnet-5'),
    ]
    expect(pickOpencodeVisionModel('opencode-zen', models)?.id).toBe(
      'opencode-zen/gpt-5-nano',
    )
    expect(pickOpencodeVisionModel(
      'opencode-zen',
      models,
      'opencode-zen/claude-sonnet-5',
    )?.id).toBe('opencode-zen/claude-sonnet-5')
    expect(pickOpencodeVisionModel(
      'opencode-go',
      [toOpencodeModelOption('opencode-go', 'glm-5.3')],
    )).toBeUndefined()
    expect(pickOpencodeVisionModel(
      'opencode-go',
      [toOpencodeModelOption('opencode-go', 'kimi-k3')],
    )?.id).toBe('opencode-go/kimi-k3')
    expect(formatOpencodeModelLabel('unknown-xyz')).toBe('Unknown Xyz')
    expect(parseOpencodeModels('opencode-zen', { data: 'nope' })).toEqual([])
  })
})

describe('loadOpencodeModels', () => {
  it('serves a fresh cache without fetching', async () => {
    const cachedModel = toOpencodeModelOption('opencode-zen', 'kimi-k3')
    const storage = createMemoryStorage({
      'shotluma-opencode-zen-models': JSON.stringify({
        fetchedAt: 500,
        models: [cachedModel],
      }),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadOpencodeModels('opencode-zen', { now: 600, storage })
    expect(result).toEqual({ models: [cachedModel], source: 'cache' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getDynamicProviderModels('opencode-zen')).toEqual([cachedModel])
    expect(readCachedOpencodeModels('opencode-zen', 600, storage)).toEqual([cachedModel])
  })

  it('fetches, caches, and registers the remote catalog', async () => {
    const storage = createMemoryStorage()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'glm-5.2' }, { id: 'kimi-k3' }] }),
    }))

    const result = await loadOpencodeModels('opencode-zen', { now: 42, storage })
    expect(result.source).toBe('remote')
    expect(result.models.map((model) => model.id)).toEqual([
      'opencode-zen/glm-5.2',
      'opencode-zen/kimi-k3',
    ])
    expect(getDynamicProviderModels('opencode-zen')).toEqual(result.models)
  })

  it('falls back to the curated shortlist when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    const result = await loadOpencodeModels('opencode-go', { now: 42, storage: null })
    expect(result.source).toBe('fallback')
    expect(result.models).toBe(getAiProvider('opencode-go').models)
  })

  it('ignores stale or invalid cache and coalesces remote loads', async () => {
    const storage = createMemoryStorage({
      'shotluma-opencode-zen-models': '{not-json',
      'shotluma-opencode-go-models': JSON.stringify({
        fetchedAt: 1,
        models: [toOpencodeModelOption('opencode-go', 'kimi-k3')],
      }),
    })
    expect(readCachedOpencodeModels('opencode-zen', 10, storage)).toBeNull()
    expect(readCachedOpencodeModels('opencode-go', 60 * 60 * 1000 + 2, storage)).toBeNull()
    expect(opencodeModelsUrl('opencode-zen', 'https://app.shotluma.com'))
      .toBe('https://app.shotluma.com/api/opencode/zen/v1/models')
    expect(opencodeModelsUrl('opencode-go', 'null'))
      .toBe('https://opencode.ai/zen/go/v1/models')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'kimi-k3' }] }),
    }))
    const [first, second, all] = await Promise.all([
      loadOpencodeModels('opencode-zen', { now: 42, storage: null }),
      loadOpencodeModels('opencode-zen', { now: 42, storage: null }),
      loadAllOpencodeModels({ now: 42, storage: null }),
    ])
    expect(first.source).toBe('remote')
    expect(second.source).toBe('remote')
    expect(all).toHaveLength(2)
  })
})

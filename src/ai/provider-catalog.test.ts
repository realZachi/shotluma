import { describe, expect, it } from 'vitest'
import {
  AI_PROVIDERS,
  DEFAULT_AI_SELECTION,
  OPENROUTER_REASONING_EFFORTS,
  clampAiReasoningEffort,
  findAiModelById,
  getAiModel,
  getAiProvider,
  getAiSdkReasoningEffort,
  getAiStreamReasoningOptions,
  getDefaultAiModel,
  getDynamicOpenRouterModels,
  isAiProviderId,
  setDynamicOpenRouterModels,
  toAiSdkReasoningEffort,
} from './provider-catalog'

describe('AI provider catalog', () => {
  it('contains the ChatGPT connection and API-key providers', () => {
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual([
      'codex',
      'moonshot',
      'google',
      'qwen',
      'openai',
      'anthropic',
      'xai',
      'openrouter',
    ])
    expect(AI_PROVIDERS.map((provider) => provider.envVar)).toEqual([
      '',
      'VITE_MOONSHOT_API_KEY',
      'VITE_GOOGLE_GENERATIVE_AI_API_KEY',
      'VITE_ALIBABA_API_KEY',
      'VITE_OPENAI_API_KEY',
      'VITE_ANTHROPIC_API_KEY',
      'VITE_XAI_API_KEY',
      'VITE_OPENROUTER_API_KEY',
    ])
    expect(AI_PROVIDERS.filter((provider) => provider.transport === 'proxy').map(
      (provider) => provider.id,
    )).toEqual(['moonshot'])
    expect(getAiProvider('codex')).toMatchObject({
      auth: 'chatgpt',
      transport: 'bridge',
    })
    expect(getAiProvider('codex').models[0]).toMatchObject({
      id: 'codex/gpt-5.6-terra',
      providerModelId: 'gpt-5.6-terra',
    })
    expect(getAiProvider('xai').models[0]?.id).toBe('grok-4.5')
    expect(getAiProvider('anthropic').models.map((model) => model.id)).toEqual([
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-haiku-4-5',
    ])
  })

  it('provides a valid default model for every provider', () => {
    for (const provider of AI_PROVIDERS) {
      expect(getDefaultAiModel(provider.id)).toBe(provider.models[0])
      expect(provider.models.length).toBeGreaterThanOrEqual(1)
    }
    expect(getAiModel(DEFAULT_AI_SELECTION).id).toBe(DEFAULT_AI_SELECTION.model)
  })

  it('validates provider and model identifiers at the UI boundary', () => {
    expect(isAiProviderId('openai')).toBe(true)
    expect(isAiProviderId('moonshot')).toBe(true)
    expect(isAiProviderId('unknown')).toBe(false)
    expect(isAiProviderId(null)).toBe(false)
    expect(() => getAiModel({ provider: 'google', model: 'not-a-model' })).toThrow(
      'Unknown google model',
    )
    expect(getAiProvider('qwen').label).toBe('Qwen')
    expect(findAiModelById('gpt-5.6-sol')).toEqual({
      provider: getAiProvider('openai'),
      model: getAiModel({ provider: 'openai', model: 'gpt-5.6-sol' }),
    })
    expect(() => findAiModelById('not-a-model')).toThrow('Unknown AI model')
  })

  it('resolves OpenRouter models dynamically without breaking static providers', () => {
    setDynamicOpenRouterModels([])
    // Curated shortlist resolves like any static provider.
    expect(getAiModel({ provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }).label)
      .toBe('Claude Sonnet 5')
    // Unknown ids synthesize instead of throwing: a selection may be restored
    // before the runtime catalog has loaded.
    const synthesized = getAiModel({ provider: 'openrouter', model: 'vendor/new-model' })
    expect(synthesized).toEqual({
      id: 'vendor/new-model',
      label: 'vendor/new-model',
      description: 'OpenRouter model',
    })
    expect(() => findAiModelById('vendor/new-model')).toThrow('Unknown AI model')

    const dynamicModel = {
      id: 'vendor/new-model',
      label: 'New Model',
      description: '$1 in · $2 out per 1M tokens',
      reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
    }
    setDynamicOpenRouterModels([dynamicModel])
    expect(getDynamicOpenRouterModels()).toEqual([dynamicModel])
    expect(getAiModel({ provider: 'openrouter', model: 'vendor/new-model' })).toBe(dynamicModel)
    expect(findAiModelById('vendor/new-model')).toEqual({
      provider: getAiProvider('openrouter'),
      model: dynamicModel,
    })
    expect(getAiSdkReasoningEffort({
      provider: 'openrouter',
      model: 'vendor/new-model',
      reasoningEffort: 'xhigh',
    })).toBe('high')
    // Static providers keep failing fast.
    expect(() => getAiModel({ provider: 'google', model: 'vendor/new-model' })).toThrow(
      'Unknown google model',
    )
    setDynamicOpenRouterModels([])
  })

  it('clamps reasoning effort to the selected model and defaults to high', () => {
    const openAiModel = getAiModel({ provider: 'openai', model: 'gpt-5.6-terra' })
    expect(clampAiReasoningEffort(openAiModel, 'high')).toBe('high')
    expect(clampAiReasoningEffort(openAiModel, 'minimal')).toBe('high')
    expect(clampAiReasoningEffort(openAiModel, undefined)).toBe('high')
    expect(clampAiReasoningEffort(
      getAiModel({ provider: 'moonshot', model: 'kimi-k3' }),
      'medium',
    )).toBe('high')
    expect(clampAiReasoningEffort(
      getAiModel({ provider: 'moonshot', model: 'kimi-k3' }),
      'max',
    )).toBe('max')
  })

  it('exposes only model-supported reasoning efforts to the AI SDK', () => {
    expect(getAiProvider('openai').models.map((model) => model.reasoningEfforts)).toEqual([
      ['low', 'medium', 'high', 'xhigh', 'max'],
      ['low', 'medium', 'high', 'xhigh', 'max'],
      ['low', 'medium', 'high', 'xhigh', 'max'],
    ])
    expect(getAiProvider('moonshot').models[0]?.reasoningEfforts).toEqual([
      'low',
      'high',
      'max',
    ])
    expect(getAiSdkReasoningEffort({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'xhigh',
    })).toBe('xhigh')
    expect(getAiSdkReasoningEffort({
      provider: 'openai',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'max',
    })).toBe('max')
    expect(getAiSdkReasoningEffort({
      provider: 'openai',
      model: 'gpt-5.6-terra',
    })).toBe('high')
    expect(getAiSdkReasoningEffort({
      provider: 'google',
      model: 'gemini-3.6-flash',
      reasoningEffort: 'xhigh',
    })).toBe('high')
    expect(getAiSdkReasoningEffort({
      provider: 'moonshot',
      model: 'kimi-k3',
      reasoningEffort: 'max',
    })).toBe('max')
    expect(toAiSdkReasoningEffort('high')).toBe('high')
    expect(toAiSdkReasoningEffort('max')).toBeUndefined()
    expect(getAiStreamReasoningOptions({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'max',
    })).toEqual({
      providerOptions: { openai: { reasoningEffort: 'max' } },
    })
    expect(getAiStreamReasoningOptions({
      provider: 'moonshot',
      model: 'kimi-k3',
      reasoningEffort: 'high',
    })).toEqual({ reasoning: 'high' })
    expect(getAiStreamReasoningOptions({
      provider: 'moonshot',
      model: 'kimi-k3',
      reasoningEffort: 'max',
    })).toEqual({
      providerOptions: { openai: { reasoningEffort: 'max' } },
    })
  })
})

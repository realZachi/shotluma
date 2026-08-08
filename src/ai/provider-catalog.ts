export type AiProviderId =
  | 'codex'
  | 'moonshot'
  | 'google'
  | 'qwen'
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'openrouter'

export type AiReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

/** Values accepted by the AI SDK top-level `reasoning` option (`max` uses provider options). */
export type AiSdkReasoningEffort = Exclude<AiReasoningEffort, 'max'>

export type AiModelSelection = {
  provider: AiProviderId
  model: string
  reasoningEffort?: AiReasoningEffort
}

export type AiModelOption = {
  id: string
  providerModelId?: string
  label: string
  description: string
  reasoningEfforts?: readonly AiReasoningEffort[]
}

export type AiProviderOption = {
  id: AiProviderId
  label: string
  envVar: string
  auth: 'apiKey' | 'chatgpt'
  transport: 'bridge' | 'direct' | 'proxy'
  models: readonly AiModelOption[]
}

export const DEFAULT_AI_REASONING_EFFORT = 'high' as const satisfies AiReasoningEffort

export const AI_REASONING_EFFORT_LABELS: Record<AiReasoningEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'XHigh',
  max: 'Max',
}

const GOOGLE_REASONING_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
] as const satisfies readonly AiReasoningEffort[]

const STANDARD_REASONING_EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
] as const satisfies readonly AiReasoningEffort[]

/** GPT-5.6 Luna / Terra / Sol: low … xhigh / max (`max` via providerOptions). */
const OPENAI_REASONING_EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const satisfies readonly AiReasoningEffort[]

const XAI_REASONING_EFFORTS = [
  'low',
  'medium',
  'high',
] as const satisfies readonly AiReasoningEffort[]

/** Kimi K3 API: low / high / max (API default is max). */
const MOONSHOT_REASONING_EFFORTS = [
  'low',
  'high',
  'max',
] as const satisfies readonly AiReasoningEffort[]

/** OpenRouter normalizes `reasoning_effort` per routed model: low / medium / high. */
export const OPENROUTER_REASONING_EFFORTS = [
  'low',
  'medium',
  'high',
] as const satisfies readonly AiReasoningEffort[]

export const AI_PROVIDERS: readonly AiProviderOption[] = [
  {
    id: 'codex',
    label: 'Codex',
    envVar: '',
    auth: 'chatgpt',
    transport: 'bridge',
    models: [
      {
        id: 'codex/gpt-5.6-terra',
        providerModelId: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        description: 'Recommended · uses your ChatGPT plan, no API key',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
      {
        id: 'codex/gpt-5.6-sol',
        providerModelId: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol',
        description: 'Highest quality · uses your ChatGPT plan',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
      {
        id: 'codex/gpt-5.6-luna',
        providerModelId: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna',
        description: 'Fast and efficient · uses your ChatGPT plan',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    envVar: 'VITE_MOONSHOT_API_KEY',
    auth: 'apiKey',
    transport: 'proxy',
    models: [
      {
        id: 'kimi-k3',
        label: 'Kimi K3',
        description: 'Existing Shotluma model · local CORS proxy required',
        reasoningEfforts: MOONSHOT_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    envVar: 'VITE_GOOGLE_GENERATIVE_AI_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    models: [
      {
        id: 'gemini-3.6-flash',
        label: 'Gemini 3.6 Flash',
        description: 'Recommended · latest fast Gemini model',
        reasoningEfforts: GOOGLE_REASONING_EFFORTS,
      },
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        description: 'Highest quality for complex layouts',
        reasoningEfforts: GOOGLE_REASONING_EFFORTS,
      },
      {
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite',
        description: 'Fast and cost-efficient',
        reasoningEfforts: GOOGLE_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'qwen',
    label: 'Qwen',
    envVar: 'VITE_ALIBABA_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    models: [
      {
        id: 'qwen3.7-plus',
        label: 'Qwen 3.7 Plus',
        description: 'Recommended · flagship vision model',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'qwen3.6-plus',
        label: 'Qwen 3.6 Plus',
        description: 'Strong quality and long context',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'qwen3.6-flash',
        label: 'Qwen 3.6 Flash',
        description: 'Fast and cost-efficient',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    envVar: 'VITE_OPENAI_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    models: [
      {
        id: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        description: 'Recommended · balanced quality and cost',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
      {
        id: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol',
        description: 'Highest quality for agentic work',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
      {
        id: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna',
        description: 'Fast and cost-efficient',
        reasoningEfforts: OPENAI_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    envVar: 'VITE_ANTHROPIC_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    models: [
      {
        id: 'claude-sonnet-5',
        label: 'Claude Sonnet 5',
        description: 'Recommended · latest balanced Claude model',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'claude-opus-5',
        label: 'Claude Opus 5',
        description: 'Highest quality for complex agentic work',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'claude-opus-4-8',
        label: 'Claude Opus 4.8',
        description: 'Previous Opus generation',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        description: 'Fast and cost-efficient',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'xai',
    label: 'xAI',
    envVar: 'VITE_XAI_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    models: [
      {
        id: 'grok-4.5',
        label: 'Grok 4.5',
        description: 'Recommended · flagship reasoning model',
        reasoningEfforts: XAI_REASONING_EFFORTS,
      },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    envVar: 'VITE_OPENROUTER_API_KEY',
    auth: 'apiKey',
    transport: 'direct',
    // Curated recommendations; the full vision+tools catalog is fetched at
    // runtime (src/ai/openrouter-models.ts) and this list doubles as the
    // offline fallback when that fetch fails.
    models: [
      {
        id: 'anthropic/claude-sonnet-5',
        label: 'Claude Sonnet 5',
        description: 'Recommended · balanced quality and cost',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'openai/gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        description: 'Balanced quality and cost',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'google/gemini-3.6-flash',
        label: 'Gemini 3.6 Flash',
        description: 'Fast and cost-efficient',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'qwen/qwen3.7-plus',
        label: 'Qwen 3.7 Plus',
        description: 'Flagship vision model',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'moonshotai/kimi-k3',
        label: 'Kimi K3',
        description: 'Kimi K3 without the local CORS proxy',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
    ],
  },
]

export const DEFAULT_AI_SELECTION: AiModelSelection = {
  provider: 'codex',
  model: 'codex/gpt-5.6-terra',
  reasoningEffort: DEFAULT_AI_REASONING_EFFORT,
}

export const isAiProviderId = (value: unknown): value is AiProviderId =>
  typeof value === 'string' && AI_PROVIDERS.some((provider) => provider.id === value)

/**
 * OpenRouter models discovered at runtime (src/ai/openrouter-models.ts).
 * Registered here so catalog lookups resolve dynamic selections; the static
 * catalog stays the source of truth for every other provider.
 */
let dynamicOpenRouterModels: readonly AiModelOption[] = []

export const setDynamicOpenRouterModels = (
  models: readonly AiModelOption[],
): void => {
  dynamicOpenRouterModels = models
}

export const getDynamicOpenRouterModels = (): readonly AiModelOption[] =>
  dynamicOpenRouterModels

const findOpenRouterModel = (modelId: string): AiModelOption | undefined =>
  getAiProvider('openrouter').models.find((option) => option.id === modelId)
  ?? dynamicOpenRouterModels.find((option) => option.id === modelId)

/**
 * A dynamic selection may outlive the fetched catalog (e.g. the model list is
 * still loading); synthesize a minimal option so lookups never throw for the
 * dynamic provider. Reasoning support is unknown, so no effort is offered.
 */
const synthesizeOpenRouterModel = (modelId: string): AiModelOption => ({
  id: modelId,
  label: modelId,
  description: 'OpenRouter model',
})

export const getAiProvider = (providerId: AiProviderId): AiProviderOption => {
  const provider = AI_PROVIDERS.find((option) => option.id === providerId)
  if (!provider) throw new Error(`Unknown AI provider: ${providerId}`)
  return provider
}

export const getDefaultAiModel = (providerId: AiProviderId): AiModelOption => {
  const model = getAiProvider(providerId).models[0]
  if (!model) throw new Error(`AI provider has no models: ${providerId}`)
  return model
}

export const getAiModel = (selection: AiModelSelection): AiModelOption => {
  if (selection.provider === 'openrouter') {
    return findOpenRouterModel(selection.model)
      ?? synthesizeOpenRouterModel(selection.model)
  }
  const model = getAiProvider(selection.provider).models.find(
    (option) => option.id === selection.model,
  )
  if (!model) {
    throw new Error(`Unknown ${selection.provider} model: ${selection.model}`)
  }
  return model
}

export const findAiModelById = (
  modelId: string,
): { provider: AiProviderOption; model: AiModelOption } => {
  for (const provider of AI_PROVIDERS) {
    const model = provider.models.find((option) => option.id === modelId)
    if (model) return { provider, model }
  }
  const dynamicModel = dynamicOpenRouterModels.find((option) => option.id === modelId)
  if (dynamicModel) {
    return { provider: getAiProvider('openrouter'), model: dynamicModel }
  }
  throw new Error(`Unknown AI model: ${modelId}`)
}

export const clampAiReasoningEffort = (
  model: AiModelOption,
  reasoningEffort: AiReasoningEffort | undefined,
): AiReasoningEffort | undefined => {
  if (!model.reasoningEfforts) return undefined
  if (reasoningEffort && model.reasoningEfforts.includes(reasoningEffort)) {
    return reasoningEffort
  }
  if (model.reasoningEfforts.includes(DEFAULT_AI_REASONING_EFFORT)) {
    return DEFAULT_AI_REASONING_EFFORT
  }
  if (model.reasoningEfforts.includes('medium')) return 'medium'
  return model.reasoningEfforts[0]
}

export const getAiSdkReasoningEffort = (
  selection: AiModelSelection,
): AiReasoningEffort | undefined => {
  const model = getAiModel(selection)
  if (!model.reasoningEfforts) {
    if (!selection.reasoningEffort) return undefined
    throw new Error(`${model.label} does not support reasoning effort`)
  }
  const reasoningEffort = clampAiReasoningEffort(model, selection.reasoningEffort)
  if (!reasoningEffort) {
    throw new Error(`Unsupported reasoning effort for ${model.label}`)
  }
  return reasoningEffort
}

/** Top-level AI SDK `reasoning` values; `max` is OpenAI-compat providerOptions only. */
export const toAiSdkReasoningEffort = (
  reasoningEffort: AiReasoningEffort,
): AiSdkReasoningEffort | undefined =>
  reasoningEffort === 'max' ? undefined : reasoningEffort

export type AiStreamReasoningOptions =
  | { reasoning: AiSdkReasoningEffort }
  | { providerOptions: { openai: { reasoningEffort: 'max' } } }

/** Options to spread into `streamText` / `generateText` for the selected effort. */
export const getAiStreamReasoningOptions = (
  selection: AiModelSelection,
): AiStreamReasoningOptions | undefined => {
  const reasoningEffort = getAiSdkReasoningEffort(selection)
  if (!reasoningEffort) return undefined
  if (reasoningEffort === 'max') {
    return { providerOptions: { openai: { reasoningEffort: 'max' } } }
  }
  return { reasoning: reasoningEffort }
}

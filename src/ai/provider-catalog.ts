export type AiProviderId =
  | 'codex'
  | 'moonshot'
  | 'google'
  | 'qwen'
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'openrouter'
  | 'opencode-zen'
  | 'opencode-go'

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
  visionModel?: string
}

export type AiModelOption = {
  id: string
  providerModelId?: string
  label: string
  description: string
  reasoningEfforts?: readonly AiReasoningEffort[]
  /** Omitted means the model accepts image input natively. */
  supportsVision?: boolean
}

export type AiProviderKeyGroup = {
  id: string
  label: string
}

export type AiProviderOption = {
  id: AiProviderId
  label: string
  envVar: string
  auth: 'apiKey' | 'chatgpt'
  transport: 'bridge' | 'direct' | 'proxy'
  models: readonly AiModelOption[]
  keyGroup?: AiProviderKeyGroup
}

export const modelSupportsVision = (model: AiModelOption): boolean =>
  model.supportsVision !== false

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

/** Grok 4.5: low / medium / high (`xhigh` is grok-4.6 only). */
const XAI_GROK_45_REASONING_EFFORTS = [
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
        id: 'gemini-3.7-flash',
        label: 'Gemini 3.7 Flash',
        description: 'Recommended · latest fast Gemini model',
        reasoningEfforts: GOOGLE_REASONING_EFFORTS,
      },
      {
        id: 'gemini-3.6-flash',
        label: 'Gemini 3.6 Flash',
        description: 'Previous Flash generation',
        reasoningEfforts: GOOGLE_REASONING_EFFORTS,
      },
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        description: 'Highest quality for complex layouts',
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
        id: 'grok-4.6',
        label: 'Grok 4.6',
        description: 'Recommended · flagship reasoning model',
        reasoningEfforts: STANDARD_REASONING_EFFORTS,
      },
      {
        id: 'grok-4.5',
        label: 'Grok 4.5',
        description: 'Previous generation',
        reasoningEfforts: XAI_GROK_45_REASONING_EFFORTS,
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
        id: 'google/gemini-3.7-flash',
        label: 'Gemini 3.7 Flash',
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
  {
    id: 'opencode-zen',
    label: 'OpenCode Zen',
    envVar: 'VITE_OPENCODE_API_KEY',
    auth: 'apiKey',
    transport: 'proxy',
    keyGroup: { id: 'opencode', label: 'OpenCode' },
    // Curated recommendations; the full tools catalog is fetched at runtime
    // (src/ai/opencode-models.ts) and this list doubles as the offline fallback.
    models: [
      {
        id: 'opencode-zen/gpt-5.6-terra',
        providerModelId: 'gpt-5.6-terra',
        label: 'GPT 5.6 Terra',
        description: 'Recommended · vision and tools',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-zen/claude-sonnet-5',
        providerModelId: 'claude-sonnet-5',
        label: 'Claude Sonnet 5',
        description: 'Balanced quality and cost',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-zen/kimi-k3',
        providerModelId: 'kimi-k3',
        label: 'Kimi K3',
        description: 'Open coding model with vision',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-zen/glm-5.2',
        providerModelId: 'glm-5.2',
        label: 'GLM 5.2',
        description: 'No native vision · a vision model describes images first',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
        supportsVision: false,
      },
    ],
  },
  {
    id: 'opencode-go',
    label: 'OpenCode Go',
    envVar: 'VITE_OPENCODE_API_KEY',
    auth: 'apiKey',
    transport: 'proxy',
    keyGroup: { id: 'opencode', label: 'OpenCode' },
    models: [
      {
        id: 'opencode-go/gpt-5.6-luna',
        providerModelId: 'gpt-5.6-luna',
        label: 'GPT 5.6 Luna',
        description: 'Recommended · vision and tools',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-go/kimi-k3',
        providerModelId: 'kimi-k3',
        label: 'Kimi K3',
        description: 'Open coding model with vision',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-go/mimo-v2.5',
        providerModelId: 'mimo-v2.5',
        label: 'MiMo V2.5',
        description: 'Fast open model with vision',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
      },
      {
        id: 'opencode-go/glm-5.3',
        providerModelId: 'glm-5.3',
        label: 'GLM 5.3',
        description: 'No native vision · a vision model describes images first',
        reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
        supportsVision: false,
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

export type AiProviderKeyField = {
  id: string
  label: string
  envVar: string
  providerIds: readonly AiProviderId[]
}

/** One API-key field per credential, sharing Zen/Go under a single OpenCode key. */
export const getAiProviderKeyFields = (): readonly AiProviderKeyField[] => {
  const fields: AiProviderKeyField[] = []
  const indexById = new Map<string, number>()
  for (const provider of AI_PROVIDERS) {
    if (provider.auth !== 'apiKey') continue
    const id = provider.keyGroup?.id ?? provider.id
    const existingIndex = indexById.get(id)
    if (existingIndex !== undefined) {
      const existing = fields[existingIndex]
      if (!existing) continue
      fields[existingIndex] = {
        ...existing,
        providerIds: [...existing.providerIds, provider.id],
      }
      continue
    }
    indexById.set(id, fields.length)
    fields.push({
      id,
      label: provider.keyGroup?.label ?? provider.label,
      envVar: provider.envVar,
      providerIds: [provider.id],
    })
  }
  return fields
}

/**
 * Runtime catalogs (OpenRouter, OpenCode Zen/Go) register here so lookups
 * resolve dynamic selections. The static catalog stays the fallback.
 */
const DYNAMIC_CATALOG_PROVIDERS = new Set<AiProviderId>([
  'openrouter',
  'opencode-zen',
  'opencode-go',
])

const dynamicModelsByProvider: Partial<Record<AiProviderId, readonly AiModelOption[]>> = {}

export const setDynamicProviderModels = (
  providerId: AiProviderId,
  models: readonly AiModelOption[],
): void => {
  dynamicModelsByProvider[providerId] = models
}

export const getDynamicProviderModels = (
  providerId: AiProviderId,
): readonly AiModelOption[] =>
  dynamicModelsByProvider[providerId] ?? []

export const setDynamicOpenRouterModels = (
  models: readonly AiModelOption[],
): void => {
  setDynamicProviderModels('openrouter', models)
}

export const getDynamicOpenRouterModels = (): readonly AiModelOption[] =>
  getDynamicProviderModels('openrouter')

const findDynamicCatalogModel = (
  providerId: AiProviderId,
  modelId: string,
): AiModelOption | undefined =>
  getAiProvider(providerId).models.find((option) => option.id === modelId)
  ?? getDynamicProviderModels(providerId).find((option) => option.id === modelId)

const synthesizeDynamicCatalogModel = (
  providerId: AiProviderId,
  modelId: string,
): AiModelOption => ({
  id: modelId,
  label: modelId,
  description: `${getAiProvider(providerId).label} model`,
})

export const isDynamicCatalogProvider = (providerId: AiProviderId): boolean =>
  DYNAMIC_CATALOG_PROVIDERS.has(providerId)

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
  if (isDynamicCatalogProvider(selection.provider)) {
    return findDynamicCatalogModel(selection.provider, selection.model)
      ?? synthesizeDynamicCatalogModel(selection.provider, selection.model)
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
  for (const providerId of DYNAMIC_CATALOG_PROVIDERS) {
    const dynamicModel = getDynamicProviderModels(providerId).find(
      (option) => option.id === modelId,
    )
    if (dynamicModel) {
      return { provider: getAiProvider(providerId), model: dynamicModel }
    }
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

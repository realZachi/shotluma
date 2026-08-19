import {
  OPENROUTER_REASONING_EFFORTS,
  getAiProvider,
  setDynamicProviderModels,
  type AiModelOption,
  type AiProviderId,
} from './provider-catalog'

export type OpencodeGateway = 'zen' | 'go'

export const OPENCODE_PROVIDERS = [
  'opencode-zen',
  'opencode-go',
] as const satisfies readonly AiProviderId[]

export type OpencodeProviderId = (typeof OPENCODE_PROVIDERS)[number]

export const isOpencodeProviderId = (
  value: unknown,
): value is OpencodeProviderId =>
  value === 'opencode-zen' || value === 'opencode-go'

export const OPENCODE_MODELS_TTL_MS = 60 * 60 * 1000

const STORAGE_KEYS: Record<OpencodeProviderId, string> = {
  'opencode-zen': 'shotluma-opencode-zen-models',
  'opencode-go': 'shotluma-opencode-go-models',
}

const GATEWAY_BY_PROVIDER: Record<OpencodeProviderId, OpencodeGateway> = {
  'opencode-zen': 'zen',
  'opencode-go': 'go',
}

/**
 * Models.dev reports these OpenCode ids as text-only. Unknown live ids default
 * to the same so a new coding model cannot silently drop screenshots.
 */
const OPENCODE_TEXT_ONLY_MODELS = new Set([
  'big-pickle',
  'deepseek-v4-flash',
  'deepseek-v4-flash-free',
  'deepseek-v4-pro',
  'glm-5',
  'glm-5.1',
  'glm-5.2',
  'glm-5.3',
  'gpt-5.3-codex-spark',
  'hy3',
  'hy3-free',
  'hy3-preview',
  'laguna-s-2.1-free',
  'minimax-m2.5',
  'minimax-m2.7',
  'nemotron-3-ultra-free',
  'nemotron-3.5-lightning-free',
  'qwen3.7-max',
])

const OPENCODE_LABEL_OVERRIDES: Record<string, string> = {
  'big-pickle': 'Big Pickle',
  hy3: 'Hy3',
  'hy3-free': 'Hy3 Free',
  'hy3-preview': 'Hy3 Preview',
  'mimo-v2.5': 'MiMo V2.5',
  'mimo-v2.5-free': 'MiMo V2.5 Free',
  'mimo-v2.5-pro': 'MiMo V2.5 Pro',
  'mimo-v2-omni': 'MiMo V2 Omni',
  'mimo-v2-pro': 'MiMo V2 Pro',
}

const DEFAULT_VISION_MODEL_IDS: Record<OpencodeProviderId, readonly string[]> = {
  'opencode-zen': [
    'opencode-zen/mimo-v2.5-free',
    'opencode-zen/gpt-5-nano',
    'opencode-zen/gemini-3.5-flash-lite',
    'opencode-zen/gpt-5.4-nano',
  ],
  'opencode-go': [
    'opencode-go/mimo-v2.5',
    'opencode-go/gpt-5.6-luna',
    'opencode-go/minimax-m3',
  ],
}

const TOKEN_LABELS: Record<string, string> = {
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  glm: 'GLM',
  gpt: 'GPT',
  grok: 'Grok',
  kimi: 'Kimi',
  laguna: 'Laguna',
  minimax: 'MiniMax',
  mimo: 'MiMo',
  muse: 'Muse',
  nemotron: 'Nemotron',
  qwen: 'Qwen',
}

export const formatOpencodeModelLabel = (modelId: string): string => {
  const override = OPENCODE_LABEL_OVERRIDES[modelId]
  if (override) return override
  return modelId.split('-').map((token) => {
    const mapped = TOKEN_LABELS[token]
    if (mapped) return mapped
    if (/[0-9]/.test(token)) return token.toUpperCase()
    if (token.length === 0) return token
    return `${token[0]?.toUpperCase() ?? ''}${token.slice(1)}`
  }).join(' ')
}

export const opencodeModelSupportsVision = (modelId: string): boolean =>
  !OPENCODE_TEXT_ONLY_MODELS.has(modelId)

export const opencodeCatalogId = (
  providerId: OpencodeProviderId,
  modelId: string,
): string => `${providerId}/${modelId}`

export const opencodeProviderModelId = (catalogId: string): string =>
  catalogId.replace(/^opencode-(?:zen|go)\//, '')

/** The upstream id to send for a catalog entry, preferring the stored mapping. */
export const opencodeRequestModelId = (
  catalogId: string,
  providerModelId?: string,
): string => providerModelId ?? opencodeProviderModelId(catalogId)

const gatewayLabel = (providerId: OpencodeProviderId): string =>
  providerId === 'opencode-go' ? 'OpenCode Go' : 'OpenCode Zen'

const describeOpencodeModel = (
  providerId: OpencodeProviderId,
  supportsVision: boolean,
): string => {
  const gateway = gatewayLabel(providerId)
  if (supportsVision) return `${gateway} · vision and tools`
  return `${gateway} · no native vision · a vision model describes images first`
}

export const toOpencodeModelOption = (
  providerId: OpencodeProviderId,
  modelId: string,
): AiModelOption => {
  const supportsVision = opencodeModelSupportsVision(modelId)
  return {
    id: opencodeCatalogId(providerId, modelId),
    providerModelId: modelId,
    label: formatOpencodeModelLabel(modelId),
    description: describeOpencodeModel(providerId, supportsVision),
    reasoningEfforts: OPENROUTER_REASONING_EFFORTS,
    ...(supportsVision ? {} : { supportsVision: false }),
  }
}

const parseModelId = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null
  const id = (value as Record<string, unknown>)['id']
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** Parse an OpenAI-compatible `/models` list into OpenCode catalog options. */
export const parseOpencodeModels = (
  providerId: OpencodeProviderId,
  payload: unknown,
): AiModelOption[] => {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as Record<string, unknown>)['data']
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const models: AiModelOption[] = []
  for (const entry of data) {
    const modelId = parseModelId(entry)
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    models.push(toOpencodeModelOption(providerId, modelId))
  }
  return models.sort((left, right) => left.label.localeCompare(right.label))
}

export const listOpencodeVisionModels = (
  models: readonly AiModelOption[],
): readonly AiModelOption[] =>
  models.filter((model) => model.supportsVision !== false)

export const pickOpencodeVisionModel = (
  providerId: OpencodeProviderId,
  models: readonly AiModelOption[],
  preferredId?: string,
): AiModelOption | undefined => {
  const visionModels = listOpencodeVisionModels(models)
  if (visionModels.length === 0) return undefined
  if (preferredId) {
    const preferred = visionModels.find((model) => model.id === preferredId)
    if (preferred) return preferred
  }
  for (const candidateId of DEFAULT_VISION_MODEL_IDS[providerId]) {
    const match = visionModels.find((model) => model.id === candidateId)
    if (match) return match
  }
  return visionModels[0]
}

type CachedOpencodeModels = {
  fetchedAt: number
  models: AiModelOption[]
}

const parseCachedModels = (raw: string | null): CachedOpencodeModels | null => {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  if (typeof record['fetchedAt'] !== 'number' || !Array.isArray(record['models'])) {
    return null
  }
  const models = record['models'].filter((entry): entry is AiModelOption => {
    if (!entry || typeof entry !== 'object') return false
    const model = entry as Record<string, unknown>
    return typeof model['id'] === 'string'
      && typeof model['label'] === 'string'
      && typeof model['description'] === 'string'
  })
  return { fetchedAt: record['fetchedAt'], models }
}

type ModelStorage = Pick<Storage, 'getItem' | 'setItem'>

const getBrowserStorage = (): ModelStorage | null => {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export const opencodeModelsUrl = (
  providerId: OpencodeProviderId,
  origin: string = typeof window === 'undefined' ? '' : window.location.origin,
): string => {
  const gateway = GATEWAY_BY_PROVIDER[providerId]
  if (origin && origin !== 'null') {
    return `${origin}/api/opencode/${gateway}/v1/models`
  }
  return gateway === 'go'
    ? 'https://opencode.ai/zen/go/v1/models'
    : 'https://opencode.ai/zen/v1/models'
}

export const readCachedOpencodeModels = (
  providerId: OpencodeProviderId,
  now: number,
  storage: ModelStorage | null = getBrowserStorage(),
): AiModelOption[] | null => {
  if (!storage) return null
  let cached: CachedOpencodeModels | null
  try {
    cached = parseCachedModels(storage.getItem(STORAGE_KEYS[providerId]))
  } catch {
    return null
  }
  if (!cached || cached.models.length === 0) return null
  if (now - cached.fetchedAt > OPENCODE_MODELS_TTL_MS) return null
  return cached.models
}

const writeCachedOpencodeModels = (
  providerId: OpencodeProviderId,
  models: AiModelOption[],
  now: number,
  storage: ModelStorage | null,
): void => {
  if (!storage) return
  try {
    storage.setItem(
      STORAGE_KEYS[providerId],
      JSON.stringify({ fetchedAt: now, models } satisfies CachedOpencodeModels),
    )
  } catch {
    // A full or blocked storage only loses the cache, not the feature.
  }
}

export type OpencodeModelsResult = {
  models: readonly AiModelOption[]
  source: 'remote' | 'cache' | 'fallback'
}

const pendingFetches = new Map<OpencodeProviderId, Promise<OpencodeModelsResult>>()

const fetchRemoteModels = async (
  providerId: OpencodeProviderId,
  now: number,
  storage: ModelStorage | null,
): Promise<OpencodeModelsResult> => {
  const response = await fetch(opencodeModelsUrl(providerId))
  if (!response.ok) {
    throw new Error(`OpenCode models request failed: ${response.status}`)
  }
  const models = parseOpencodeModels(providerId, await response.json() as unknown)
  if (models.length === 0) throw new Error('OpenCode models response was empty')
  writeCachedOpencodeModels(providerId, models, now, storage)
  setDynamicProviderModels(providerId, models)
  return { models, source: 'remote' }
}

/**
 * Load an OpenCode gateway catalog: fresh cache, then the proxied `/models`
 * list, then the curated shortlist. Successful loads register the models so
 * selections resolve everywhere. Never rejects.
 */
export const loadOpencodeModels = (
  providerId: OpencodeProviderId,
  options?: {
    now?: number
    storage?: ModelStorage | null
  },
): Promise<OpencodeModelsResult> => {
  const now = options?.now ?? Date.now()
  const storage = options?.storage === undefined ? getBrowserStorage() : options.storage

  const cached = readCachedOpencodeModels(providerId, now, storage)
  if (cached) {
    setDynamicProviderModels(providerId, cached)
    return Promise.resolve({ models: cached, source: 'cache' })
  }

  const pending = pendingFetches.get(providerId)
    ?? fetchRemoteModels(providerId, now, storage)
      .catch((): OpencodeModelsResult => ({
        models: getAiProvider(providerId).models,
        source: 'fallback',
      }))
      .finally(() => {
        pendingFetches.delete(providerId)
      })
  pendingFetches.set(providerId, pending)
  return pending
}

export const loadAllOpencodeModels = (options?: {
  now?: number
  storage?: ModelStorage | null
}): Promise<readonly OpencodeModelsResult[]> =>
  Promise.all(OPENCODE_PROVIDERS.map((providerId) => loadOpencodeModels(providerId, options)))

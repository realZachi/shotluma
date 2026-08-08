import {
  AI_PROVIDERS,
  DEFAULT_AI_REASONING_EFFORT,
  DEFAULT_AI_SELECTION,
  clampAiReasoningEffort,
  getDefaultAiModel,
  type AiModelSelection,
  type AiProviderId,
} from './provider-catalog'

export type AiProviderKeys = Record<AiProviderId, string>
export type AiProviderAvailability = Record<AiProviderId, boolean>
export type AiProviderKeyWriteResult =
  | { ok: true }
  | { ok: false; error: string }

type AiProviderEnvironment = {
  VITE_MOONSHOT_API_KEY?: unknown
  VITE_GOOGLE_GENERATIVE_AI_API_KEY?: unknown
  VITE_ALIBABA_API_KEY?: unknown
  VITE_OPENAI_API_KEY?: unknown
  VITE_ANTHROPIC_API_KEY?: unknown
  VITE_XAI_API_KEY?: unknown
  VITE_OPENROUTER_API_KEY?: unknown
}

export const AI_PROVIDER_KEYS_STORAGE_KEY = 'shotluma-ai-provider-keys'

const PROVIDER_IDS = AI_PROVIDERS.map((provider) => provider.id)

const readKey = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

export const createEmptyAiProviderKeys = (): AiProviderKeys => ({
  codex: '',
  moonshot: '',
  google: '',
  qwen: '',
  openai: '',
  anthropic: '',
  xai: '',
  openrouter: '',
})

export const createAiProviderKeys = (
  environment: AiProviderEnvironment,
): AiProviderKeys => ({
  codex: '',
  moonshot: readKey(environment.VITE_MOONSHOT_API_KEY),
  google: readKey(environment.VITE_GOOGLE_GENERATIVE_AI_API_KEY),
  qwen: readKey(environment.VITE_ALIBABA_API_KEY),
  openai: readKey(environment.VITE_OPENAI_API_KEY),
  anthropic: readKey(environment.VITE_ANTHROPIC_API_KEY),
  xai: readKey(environment.VITE_XAI_API_KEY),
  openrouter: readKey(environment.VITE_OPENROUTER_API_KEY),
})

export const getAiProviderAvailability = (
  keys: AiProviderKeys,
): AiProviderAvailability => ({
  codex: false,
  moonshot: keys.moonshot.length > 0,
  google: keys.google.length > 0,
  qwen: keys.qwen.length > 0,
  openai: keys.openai.length > 0,
  anthropic: keys.anthropic.length > 0,
  xai: keys.xai.length > 0,
  openrouter: keys.openrouter.length > 0,
})

const getBrowserHostname = (): string => {
  try {
    return typeof window === 'undefined' ? '' : window.location.hostname
  } catch {
    return ''
  }
}

export const isLocalAiProxyHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized === '::1'
}

export const getAiProviderTransportAvailability = (
  hostname: string = getBrowserHostname(),
): AiProviderAvailability => ({
  codex: true,
  moonshot: isLocalAiProxyHostname(hostname),
  google: true,
  qwen: true,
  openai: true,
  anthropic: true,
  xai: true,
  openrouter: true,
})

export const mergeAiProviderKeys = (
  environmentKeys: AiProviderKeys,
  storedKeys: AiProviderKeys,
): AiProviderKeys => {
  const merged = createEmptyAiProviderKeys()
  for (const providerId of PROVIDER_IDS) {
    merged[providerId] = storedKeys[providerId] || environmentKeys[providerId]
  }
  return merged
}

export const parseStoredAiProviderKeys = (raw: string | null): AiProviderKeys => {
  const keys = createEmptyAiProviderKeys()
  if (!raw) return keys

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return keys
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return keys

  const record = parsed as Record<string, unknown>
  for (const providerId of PROVIDER_IDS) {
    keys[providerId] = readKey(record[providerId])
  }
  return keys
}

export const serializeStoredAiProviderKeys = (keys: AiProviderKeys): string => {
  const payload: Partial<Record<AiProviderId, string>> = {}
  for (const providerId of PROVIDER_IDS) {
    const value = readKey(keys[providerId])
    if (value) payload[providerId] = value
  }
  return JSON.stringify(payload)
}

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const getBrowserStorage = (): KeyStorage | null => {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export const readStoredAiProviderKeys = (
  storage: KeyStorage | null = getBrowserStorage(),
): AiProviderKeys => {
  if (!storage) return createEmptyAiProviderKeys()
  try {
    return parseStoredAiProviderKeys(storage.getItem(AI_PROVIDER_KEYS_STORAGE_KEY))
  } catch {
    return createEmptyAiProviderKeys()
  }
}

export const writeStoredAiProviderKeys = (
  keys: AiProviderKeys,
  storage: KeyStorage | null = getBrowserStorage(),
): AiProviderKeyWriteResult => {
  if (!storage) {
    return {
      ok: false,
      error: 'Browser storage is unavailable. The API keys were not saved.',
    }
  }
  const normalized = createEmptyAiProviderKeys()
  let hasAny = false
  for (const providerId of PROVIDER_IDS) {
    const value = readKey(keys[providerId])
    normalized[providerId] = value
    if (value) hasAny = true
  }

  try {
    if (!hasAny) {
      storage.removeItem(AI_PROVIDER_KEYS_STORAGE_KEY)
      return { ok: true }
    }
    storage.setItem(AI_PROVIDER_KEYS_STORAGE_KEY, serializeStoredAiProviderKeys(normalized))
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'The browser blocked local storage. The previous API keys were left unchanged.',
    }
  }
}

export const getResolvedAiProviderKeys = (
  storage: KeyStorage | null = getBrowserStorage(),
): AiProviderKeys =>
  mergeAiProviderKeys(ENVIRONMENT_AI_PROVIDER_KEYS, readStoredAiProviderKeys(storage))

export const getResolvedAiProviderAvailability = (
  storage: KeyStorage | null = getBrowserStorage(),
  hostname: string = getBrowserHostname(),
): AiProviderAvailability => {
  const keyAvailability = getAiProviderAvailability(getResolvedAiProviderKeys(storage))
  const transportAvailability = getAiProviderTransportAvailability(hostname)
  const availability = { ...keyAvailability }
  for (const providerId of PROVIDER_IDS) {
    availability[providerId] = keyAvailability[providerId] && transportAvailability[providerId]
  }
  return availability
}

export const getInitialAiSelection = (
  availability: AiProviderAvailability,
): AiModelSelection => {
  const provider = AI_PROVIDERS.find((option) => availability[option.id])
  if (!provider) return DEFAULT_AI_SELECTION
  const model = getDefaultAiModel(provider.id)
  const reasoningEffort = clampAiReasoningEffort(model, DEFAULT_AI_REASONING_EFFORT)
  return {
    provider: provider.id,
    model: model.id,
    ...(reasoningEffort ? { reasoningEffort } : {}),
  }
}

export const ENVIRONMENT_AI_PROVIDER_KEYS = createAiProviderKeys({
  VITE_MOONSHOT_API_KEY: import.meta.env.VITE_MOONSHOT_API_KEY,
  VITE_GOOGLE_GENERATIVE_AI_API_KEY: import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY,
  VITE_ALIBABA_API_KEY: import.meta.env.VITE_ALIBABA_API_KEY,
  VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY,
  VITE_ANTHROPIC_API_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY,
  VITE_XAI_API_KEY: import.meta.env.VITE_XAI_API_KEY,
  VITE_OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
})

export const AI_PROVIDER_AVAILABILITY = getResolvedAiProviderAvailability()
export const INITIAL_AI_SELECTION = getInitialAiSelection(AI_PROVIDER_AVAILABILITY)

export const getAiProviderKey = (providerId: AiProviderId): string =>
  getResolvedAiProviderKeys()[providerId]

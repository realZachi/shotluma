import { opencodeSelectionDialect } from './opencode-dialects'
import {
  getAiStreamReasoningOptions,
  type AiModelSelection,
  type AiSdkReasoningEffort,
} from './provider-catalog'
import type { ModelMessage, SystemModelMessage } from 'ai'

/**
 * Options spread into `streamText`: the catalog's reasoning-effort mapping plus
 * per-provider prompt-cache routing. Every step of a multi-step run re-reads the
 * whole growing conversation, so cache configuration directly controls run cost.
 */
export type AiStreamRequestOptions = {
  reasoning?: AiSdkReasoningEffort
  providerOptions?: {
    openai?: {
      reasoningEffort?: 'max'
      promptCacheKey?: string
      promptCacheOptions?: { mode: 'implicit'; ttl: '30m' }
    }
    google?: { thinkingConfig: { includeThoughts: true } }
  }
}

/**
 * Reasoning *visibility* is a separate switch from reasoning *effort*, and the
 * providers are asymmetric about it.
 *
 * OpenAI's Responses API defaults `reasoningSummary` to `'detailed'` as soon as an
 * effort is set, so thoughts stream without being asked for. Google does not: in
 * `@ai-sdk/google`, `thinkingLevel` and `thinkingBudget` fall back to the mapped
 * top-level `reasoning` value, but `includeThoughts` is read *only* from
 * `providerOptions.google.thinkingConfig`, with no fallback. Omit it and Gemini
 * still thinks and still bills those tokens while withholding every thought
 * summary — the run band then has no live prose to show for the whole run.
 *
 * OpenCode's Gemini models run on the same Google provider through the gateway,
 * so they need the same option to stream thoughts.
 *
 * Keep this object limited to `includeThoughts`. Adding `thinkingLevel` or
 * `thinkingBudget` here would take full precedence over the portable `reasoning`
 * option and silently discard the user's effort choice.
 */
const GOOGLE_THOUGHT_OPTIONS = { thinkingConfig: { includeThoughts: true } } as const

const usesGoogleGeneration = (selection: AiModelSelection): boolean =>
  selection.provider === 'google'
  || opencodeSelectionDialect(selection) === 'google'

/**
 * Combine the reasoning-effort options with OpenAI's request-wide cache
 * routing. Implicit mode intentionally stays enabled: its moving breakpoint
 * caches the growing tool loop, while the explicit instruction breakpoint
 * added below also preserves the stable cross-run prefix.
 *
 * OpenAI recommends an explicit `prompt_cache_key` for reliable prefix-cache
 * routing; one browser-session key per prompt variant keeps related runs on the
 * same cache while naturally sharding traffic across clients.
 * The key is only sent to OpenAI itself — Moonshot shares the OpenAI-compat
 * `reasoningEffort` namespace but its API does not document the cache field.
 */
export const buildStreamRequestOptions = (
  selection: AiModelSelection,
  promptCacheKey: string,
): AiStreamRequestOptions => {
  const reasoningOptions = getAiStreamReasoningOptions(selection)
  if (usesGoogleGeneration(selection)) {
    return {
      ...(reasoningOptions && 'reasoning' in reasoningOptions
        ? { reasoning: reasoningOptions.reasoning }
        : {}),
      providerOptions: { google: GOOGLE_THOUGHT_OPTIONS },
    }
  }
  if (selection.provider !== 'openai') return reasoningOptions ?? {}

  const openaiReasoning
    = reasoningOptions && 'providerOptions' in reasoningOptions
      ? reasoningOptions.providerOptions.openai
      : undefined
  return {
    ...(reasoningOptions && 'reasoning' in reasoningOptions
      ? { reasoning: reasoningOptions.reasoning }
      : {}),
    providerOptions: {
      openai: {
        ...openaiReasoning,
        promptCacheKey,
        promptCacheOptions: { mode: 'implicit', ttl: '30m' },
      },
    },
  }
}

type ExplicitCacheProvider = 'anthropic' | 'alibaba'

const instructionProviderOptions = (
  provider: AiModelSelection['provider'],
): SystemModelMessage['providerOptions'] | undefined => {
  if (provider === 'openai') {
    return {
      openai: { promptCacheBreakpoint: { mode: 'explicit' } },
    }
  }
  if (provider === 'anthropic') {
    return {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    }
  }
  if (provider === 'qwen') {
    return {
      alibaba: { cacheControl: { type: 'ephemeral' } },
    }
  }
  return undefined
}

/**
 * Mark the end of the static instructions for providers with explicit cache
 * controls. Tool definitions precede system instructions in Anthropic and
 * Alibaba prompts, so their marker caches both. OpenAI also keeps its implicit
 * moving breakpoint for the append-only tool loop.
 */
export const withStaticInstructionCacheBreakpoint = (
  instructions: string,
  provider: AiModelSelection['provider'],
): string | SystemModelMessage => {
  const providerOptions = instructionProviderOptions(provider)
  if (!providerOptions) return instructions
  return { role: 'system', content: instructions, providerOptions }
}

const stripCacheControl = (
  message: ModelMessage,
  provider: ExplicitCacheProvider,
): ModelMessage => {
  const cacheOptions = message.providerOptions?.[provider]
  if (!cacheOptions || !('cacheControl' in cacheOptions)) return message

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cacheControl, ...remainingOptions } = cacheOptions
  const providerOptions = { ...message.providerOptions }
  if (Object.keys(remainingOptions).length > 0) {
    providerOptions[provider] = remainingOptions
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete providerOptions[provider]
  }
  if (Object.keys(providerOptions).length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { providerOptions: _omitted, ...rest } = message
    return rest
  }
  return { ...message, providerOptions }
}

const withCacheBreakpoint = (
  message: ModelMessage,
  provider: ExplicitCacheProvider,
): ModelMessage => ({
  ...message,
  providerOptions: {
    ...message.providerOptions,
    [provider]: {
      ...message.providerOptions?.[provider],
      cacheControl: { type: 'ephemeral' },
    },
  },
})

/**
 * Anthropic caches nothing without explicit `cache_control` breakpoints, so an
 * unmarked tool loop re-reads the entire conversation at the full input price on
 * every step. This applies the documented moving-breakpoint pattern: mark the
 * last message so each step writes the whole prefix and the next step reads it
 * back (Anthropic looks back from the breakpoint to find the previous cache hit).
 *
 * Marks from earlier steps are stripped — `prepareStep` message overrides carry
 * forward, and Anthropic rejects requests with more than 4 breakpoints. Only the
 * `cacheControl` key is touched; other provider options survive untouched.
 */
export const withMovingCacheBreakpoint = (
  messages: ModelMessage[],
  provider: ExplicitCacheProvider,
): ModelMessage[] =>
  messages.map((message, index) =>
    index === messages.length - 1
      ? withCacheBreakpoint(message, provider)
      : stripCacheControl(message, provider))

export const withMovingAnthropicCacheBreakpoint = (
  messages: ModelMessage[],
): ModelMessage[] => withMovingCacheBreakpoint(messages, 'anthropic')

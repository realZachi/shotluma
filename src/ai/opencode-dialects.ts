import {
  isOpencodeProviderId,
  opencodeRequestModelId,
  type OpencodeProviderId,
} from './opencode-models'
import { getAiModel, type AiModelSelection } from './provider-catalog'

/**
 * OpenCode Zen and Go are multi-dialect gateways: every model answers on exactly
 * one endpoint, and the wrong one fails with a 400 or an "Endpoint is
 * unavailable" 5xx instead of falling back. The table mirrors the endpoint
 * columns published at https://opencode.ai/docs/zen and https://opencode.ai/docs/go.
 */
export type OpencodeDialect = 'responses' | 'messages' | 'google' | 'chat'

const PREFIX_DIALECTS: readonly (readonly [string, OpencodeDialect])[] = [
  ['gpt-', 'responses'],
  ['grok-', 'responses'],
  ['muse-spark-', 'responses'],
  ['claude-', 'messages'],
  ['qwen', 'messages'],
  ['gemini-', 'google'],
]

/** MiniMax is the one family the two gateways route differently. */
const GATEWAY_PREFIX_DIALECTS: Record<
  OpencodeProviderId,
  readonly (readonly [string, OpencodeDialect])[]
> = {
  'opencode-zen': [['minimax-', 'chat']],
  'opencode-go': [['minimax-', 'messages']],
}

const matchPrefix = (
  modelId: string,
  table: readonly (readonly [string, OpencodeDialect])[],
): OpencodeDialect | null => {
  for (const [prefix, dialect] of table) {
    if (modelId.startsWith(prefix)) return dialect
  }
  return null
}

/**
 * Resolve the endpoint dialect for an upstream OpenCode model id. Prefixes are
 * used rather than a fixed id list because `/v1/models` keeps gaining entries;
 * the open-weight families (DeepSeek, GLM, Kimi, MiMo, Hy3, Laguna, Nemotron,
 * Big Pickle, and the free tier) all answer on chat completions, which makes it
 * the correct default for an unrecognised id.
 */
export const opencodeModelDialect = (
  providerId: OpencodeProviderId,
  modelId: string,
): OpencodeDialect =>
  matchPrefix(modelId, GATEWAY_PREFIX_DIALECTS[providerId])
  ?? matchPrefix(modelId, PREFIX_DIALECTS)
  ?? 'chat'

/** The dialect a selection resolves to, or `null` for a non-OpenCode provider. */
export const opencodeSelectionDialect = (
  selection: AiModelSelection,
): OpencodeDialect | null => {
  if (!isOpencodeProviderId(selection.provider)) return null
  const model = getAiModel(selection)
  return opencodeModelDialect(
    selection.provider,
    opencodeRequestModelId(model.id, model.providerModelId),
  )
}

/** Only the chat-completions dialect rejects images inside tool results. */
export const opencodeDialectNeedsChatToolImageRelay = (
  dialect: OpencodeDialect,
): boolean => dialect === 'chat'

import {
  DEFAULT_AI_REASONING_EFFORT,
  isAiProviderId,
  type AiModelSelection,
  type AiReasoningEffort,
} from './provider-catalog'
import type { FinishReason, LanguageModelUsage } from 'ai'

export const AI_RUN_LOG_SCHEMA_VERSION = 2
export const AI_RUN_LOG_TEXT_LIMIT = 250_000
export const AI_RUN_LOG_ENDPOINT = '/api/ai-run-logs'
export const AI_RUN_LOG_DIRECTORY = 'ai-logs'

export type AiRunMode = 'generate' | 'edit'
export type AiRunOutcome = 'completed' | 'failed' | 'cancelled'

export type AiRunTokenUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  textTokens: number | null
  reasoningTokens: number | null
  noCacheTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
}

export type AiRunToolCall = {
  name: string
  detail: string
  offsetMs: number
}

export type AiRunStep = {
  usage: AiRunTokenUsage
  toolCallCount: number
  previewCount: number
}

export type AiRunReport = {
  outcome: AiRunOutcome
  assistantOutput: string
  reasoningOutput: string
  toolCalls: AiRunToolCall[]
  steps: AiRunStep[]
  slidesCreated: number
  usage: AiRunTokenUsage | null
  finishReason: FinishReason | null
  errorMessage: string | null
}

export type AiRunLog = {
  schemaVersion: typeof AI_RUN_LOG_SCHEMA_VERSION
  id: string
  startedAt: string
  durationMs: number
  mode: AiRunMode
  provider: AiModelSelection['provider']
  model: string
  reasoningEffort: AiReasoningEffort
  request: {
    descriptionCharacters: number
    screenshotCount: number
  }
  outcome: AiRunOutcome
  assistantOutput: string
  assistantOutputTruncated: boolean
  reasoningOutput: string
  reasoningOutputTruncated: boolean
  toolCalls: AiRunToolCall[]
  steps: AiRunStep[]
  slidesCreated: number
  usage: AiRunTokenUsage | null
  finishReason: FinishReason | null
  errorMessage: string | null
}

export type CreateAiRunLogOptions = {
  id: string
  startedAt: number
  finishedAt: number
  mode: AiRunMode
  selection: AiModelSelection
  descriptionCharacters: number
  screenshotCount: number
  report: AiRunReport
}

const nullableTokenCount = (value: number | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const toAiRunTokenUsage = (usage: LanguageModelUsage): AiRunTokenUsage => ({
  inputTokens: nullableTokenCount(usage.inputTokens),
  outputTokens: nullableTokenCount(usage.outputTokens),
  totalTokens: nullableTokenCount(usage.totalTokens),
  textTokens: nullableTokenCount(usage.outputTokenDetails.textTokens),
  reasoningTokens: nullableTokenCount(usage.outputTokenDetails.reasoningTokens),
  noCacheTokens: nullableTokenCount(usage.inputTokenDetails.noCacheTokens),
  cacheReadTokens: nullableTokenCount(usage.inputTokenDetails.cacheReadTokens),
  cacheWriteTokens: nullableTokenCount(usage.inputTokenDetails.cacheWriteTokens),
})

const limitText = (value: string) => {
  if (value.length <= AI_RUN_LOG_TEXT_LIMIT) {
    return { text: value, isTruncated: false }
  }
  return {
    text: `${value.slice(0, AI_RUN_LOG_TEXT_LIMIT)}\n… [truncated by Shotluma]`,
    isTruncated: true,
  }
}

const nonNegativeInteger = (value: number) =>
  Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))

export const createAiRunLog = ({
  id,
  startedAt,
  finishedAt,
  mode,
  selection,
  descriptionCharacters,
  screenshotCount,
  report,
}: CreateAiRunLogOptions): AiRunLog => {
  const assistantOutput = limitText(report.assistantOutput)
  const reasoningOutput = limitText(report.reasoningOutput)

  return {
    schemaVersion: AI_RUN_LOG_SCHEMA_VERSION,
    id,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: nonNegativeInteger(finishedAt - startedAt),
    mode,
    provider: selection.provider,
    model: selection.model,
    reasoningEffort: selection.reasoningEffort ?? DEFAULT_AI_REASONING_EFFORT,
    request: {
      descriptionCharacters: nonNegativeInteger(descriptionCharacters),
      screenshotCount: nonNegativeInteger(screenshotCount),
    },
    outcome: report.outcome,
    assistantOutput: assistantOutput.text,
    assistantOutputTruncated: assistantOutput.isTruncated,
    reasoningOutput: reasoningOutput.text,
    reasoningOutputTruncated: reasoningOutput.isTruncated,
    toolCalls: report.toolCalls.map((toolCall) => ({ ...toolCall })),
    steps: report.steps.slice(0, 64).map((step) => ({
      usage: { ...step.usage },
      toolCallCount: nonNegativeInteger(step.toolCallCount),
      previewCount: nonNegativeInteger(step.previewCount),
    })),
    slidesCreated: nonNegativeInteger(report.slidesCreated),
    usage: report.usage ? { ...report.usage } : null,
    finishReason: report.finishReason,
    errorMessage: report.errorMessage,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isNullableTokenCount = (value: unknown): value is number | null =>
  value === null || isNonNegativeNumber(value)

const normalizeUsage = (value: unknown): AiRunTokenUsage | null | undefined => {
  if (value === null) return null
  if (!isRecord(value)) return undefined

  const inputTokens = value['inputTokens']
  const outputTokens = value['outputTokens']
  const totalTokens = value['totalTokens']
  const textTokens = value['textTokens']
  const reasoningTokens = value['reasoningTokens']
  const noCacheTokens = value['noCacheTokens']
  const cacheReadTokens = value['cacheReadTokens']
  const cacheWriteTokens = value['cacheWriteTokens']
  if (
    !isNullableTokenCount(inputTokens)
    || !isNullableTokenCount(outputTokens)
    || !isNullableTokenCount(totalTokens)
    || !isNullableTokenCount(textTokens)
    || !isNullableTokenCount(reasoningTokens)
    || !isNullableTokenCount(noCacheTokens)
    || !isNullableTokenCount(cacheReadTokens)
    || !isNullableTokenCount(cacheWriteTokens)
  ) return undefined

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    textTokens,
    reasoningTokens,
    noCacheTokens,
    cacheReadTokens,
    cacheWriteTokens,
  }
}

const normalizeToolCalls = (value: unknown): AiRunToolCall[] | null => {
  if (!Array.isArray(value)) return null
  const toolCalls: AiRunToolCall[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const name = item['name']
    const detail = item['detail']
    const offsetMs = item['offsetMs']
    if (
      typeof name !== 'string'
      || typeof detail !== 'string'
      || !isNonNegativeNumber(offsetMs)
    ) return null
    toolCalls.push({
      name,
      detail,
      offsetMs,
    })
  }
  return toolCalls
}

const normalizeSteps = (value: unknown): AiRunStep[] | null => {
  if (!Array.isArray(value) || value.length > 64) return null
  const steps: AiRunStep[] = []
  for (const item of value) {
    if (!isRecord(item)) return null
    const usage = normalizeUsage(item['usage'])
    const toolCallCount = item['toolCallCount']
    const previewCount = item['previewCount']
    if (
      !usage
      || !isNonNegativeNumber(toolCallCount)
      || !isNonNegativeNumber(previewCount)
    ) return null
    steps.push({ usage, toolCallCount, previewCount })
  }
  return steps
}

const isAiRunMode = (value: unknown): value is AiRunMode =>
  value === 'generate' || value === 'edit'

const isAiRunOutcome = (value: unknown): value is AiRunOutcome =>
  value === 'completed' || value === 'failed' || value === 'cancelled'

const isAiReasoningEffort = (value: unknown): value is AiReasoningEffort =>
  value === 'minimal'
  || value === 'low'
  || value === 'medium'
  || value === 'high'
  || value === 'xhigh'
  || value === 'max'

const isFinishReason = (value: unknown): value is FinishReason =>
  value === 'stop'
  || value === 'length'
  || value === 'content-filter'
  || value === 'tool-calls'
  || value === 'error'
  || value === 'other'

const normalizeRequest = (value: unknown): AiRunLog['request'] | null => {
  if (
    !isRecord(value)
    || !isNonNegativeNumber(value['descriptionCharacters'])
    || !isNonNegativeNumber(value['screenshotCount'])
  ) return null
  return {
    descriptionCharacters: value['descriptionCharacters'],
    screenshotCount: value['screenshotCount'],
  }
}

const normalizeRunDetails = (value: Record<string, unknown>): {
  toolCalls: AiRunToolCall[]
  steps: AiRunStep[]
  usage: AiRunTokenUsage | null
} | null => {
  const toolCalls = normalizeToolCalls(value['toolCalls'])
  const steps = normalizeSteps(value['steps'])
  const usage = normalizeUsage(value['usage'])
  if (!toolCalls || !steps || usage === undefined) return null
  return { toolCalls, steps, usage }
}

export const normalizeAiRunLog = (value: unknown): AiRunLog | null => {
  if (!isRecord(value) || value['schemaVersion'] !== AI_RUN_LOG_SCHEMA_VERSION) return null
  const id = value['id']
  const startedAt = value['startedAt']
  const durationMs = value['durationMs']
  const mode = value['mode']
  const provider = value['provider']
  const model = value['model']
  const rawReasoningEffort = value['reasoningEffort']
  const reasoningEffort = rawReasoningEffort === 'provider-default'
    ? DEFAULT_AI_REASONING_EFFORT
    : rawReasoningEffort
  const request = normalizeRequest(value['request'])
  const outcome = value['outcome']
  const assistantOutput = value['assistantOutput']
  const assistantOutputTruncated = value['assistantOutputTruncated']
  const reasoningOutput = value['reasoningOutput']
  const reasoningOutputTruncated = value['reasoningOutputTruncated']
  const slidesCreated = value['slidesCreated']
  const finishReason = value['finishReason']
  const errorMessage = value['errorMessage']
  if (
    typeof id !== 'string'
    || typeof startedAt !== 'string'
    || !Number.isFinite(Date.parse(startedAt))
    || !isNonNegativeNumber(durationMs)
    || !isAiRunMode(mode)
    || !isAiProviderId(provider)
    || typeof model !== 'string'
    || !isAiReasoningEffort(reasoningEffort)
    || !request
    || !isAiRunOutcome(outcome)
    || typeof assistantOutput !== 'string'
    || typeof assistantOutputTruncated !== 'boolean'
    || typeof reasoningOutput !== 'string'
    || typeof reasoningOutputTruncated !== 'boolean'
    || !isNonNegativeNumber(slidesCreated)
    || !(finishReason === null || isFinishReason(finishReason))
    || !(errorMessage === null || typeof errorMessage === 'string')
  ) return null

  const details = normalizeRunDetails(value)
  if (!details) return null

  return {
    schemaVersion: AI_RUN_LOG_SCHEMA_VERSION,
    id,
    startedAt,
    durationMs,
    mode,
    provider,
    model,
    reasoningEffort,
    request,
    outcome,
    assistantOutput,
    assistantOutputTruncated,
    reasoningOutput,
    reasoningOutputTruncated,
    toolCalls: details.toolCalls,
    steps: details.steps,
    slidesCreated,
    usage: details.usage,
    finishReason,
    errorMessage,
  }
}

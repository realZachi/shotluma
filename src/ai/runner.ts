import {
  APICallError,
  isStepCount,
  smoothStream,
  streamText,
  type FinishReason,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
} from 'ai'
import { uid } from '../utils'
import { runCodexAppServerGeneration } from './codex-app-server'
import { readCodexConnection } from './codex-connection'
import { scopeAiControllerToSlide, type AiEditorController } from './controller'
import { buildInstructions, buildUserMessage } from './prompt'
import {
  buildStreamRequestOptions,
  withMovingAnthropicCacheBreakpoint,
} from './prompt-caching'
import {
  AI_REASONING_EFFORT_LABELS,
  getAiModel,
  getAiProvider,
  getAiSdkReasoningEffort,
  type AiModelSelection,
} from './provider-catalog'
import {
  getAiProviderKey,
  getAiProviderTransportAvailability,
} from './provider-config'
import {
  toAiRunTokenUsage,
  type AiRunReport,
  type AiRunTokenUsage,
  type AiRunToolCall,
} from './run-log'
import { saveAiRunReport } from './run-log-client'
import { parsePlanInput } from './run-plan'
import { describeAiToolCall } from './tool-call-description'
import { createEditorTools } from './tools'
import type { AiRunEvent } from './run-events'
import type { AiToolActivity } from './tools'

export type { AiToolActivity } from './tools'
export type { AiRunEvent } from './run-events'

type UserContent =
  | { type: 'text'; text: string }
  | { type: 'file'; mediaType: string; data: string }

const extractMediaType = (dataUrl: string): string => {
  const match = /^data:([^;,]+)/.exec(dataUrl)
  return match?.[1] ?? 'image/png'
}

type PreparedAsset = { assetId: string; name: string; dataUrl: string }

const buildUserContent = (options: {
  description: string
  screenshots: PreparedAsset[]
  appName?: string
  logo?: PreparedAsset
  targetSlideId?: string
}): UserContent[] => {
  const { description, screenshots, appName, logo, targetSlideId } = options
  const content: UserContent[] = [{
    type: 'text',
    text: buildUserMessage(
      description,
      screenshots.map(({ assetId, name }) => ({ assetId, name })),
      {
        ...(targetSlideId ? { targetSlideId } : {}),
        ...(appName?.trim() ? { appName: appName.trim() } : {}),
        ...(logo ? { logoAssetId: logo.assetId } : {}),
      },
    ),
  }]

  for (const shot of screenshots) {
    content.push({ type: 'text', text: `Screenshot asset "${shot.assetId}" (${shot.name}):` })
    content.push({ type: 'file', mediaType: extractMediaType(shot.dataUrl), data: shot.dataUrl })
  }

  if (logo) {
    content.push({
      type: 'text',
      text: `App logo asset "${logo.assetId}" (${logo.name}) — place with add_image, never as a device screenshot:`,
    })
    content.push({ type: 'file', mediaType: extractMediaType(logo.dataUrl), data: logo.dataUrl })
  }

  return content
}

const createAiModel = async (selection: AiModelSelection) => {
  if (!getAiProviderTransportAvailability()[selection.provider]) {
    throw new Error('Moonshot requires the local Shotluma CORS proxy and is unavailable on this host')
  }
  const apiKey = getAiProviderKey(selection.provider)
  if (!apiKey) {
    throw new Error(`${getAiProvider(selection.provider).envVar} is not configured`)
  }

  switch (selection.provider) {
    case 'codex':
      throw new Error('Codex subscription runs must use the local Shotluma Codex Bridge')
    case 'moonshot': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({
        apiKey,
        baseURL: `${window.location.origin}/api/moonshot/v1`,
      }).chat(selection.model)
    }
    case 'google': {
      const { createGoogle } = await import('@ai-sdk/google')
      return createGoogle({ apiKey })(selection.model)
    }
    case 'qwen': {
      const { createAlibaba } = await import('@ai-sdk/alibaba')
      return createAlibaba({ apiKey })(selection.model)
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({ apiKey })(selection.model)
    }
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({
        apiKey,
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      })(selection.model)
    }
    case 'xai': {
      const { createXai } = await import('@ai-sdk/xai')
      return createXai({ apiKey })(selection.model)
    }
    case 'openrouter': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      // OpenRouter speaks the OpenAI chat-completions dialect and allows
      // browser CORS; the optional headers attribute traffic to the app.
      return createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Shotluma',
        },
      }).chat(selection.model)
    }
  }
}

const describeError = (error: unknown, selection: AiModelSelection): string => {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      const provider = getAiProvider(selection.provider)
      return `${provider.label} API error (${error.statusCode}) — check the API key for ${provider.label} and try again. ${error.message}`
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}

const isAbortError = (error: unknown): boolean =>
  (error instanceof Error && error.name === 'AbortError') || (error instanceof DOMException && error.name === 'AbortError')

type AiRunAccumulator = {
  assistantOutput: string
  reasoningOutput: string
  toolCalls: AiRunToolCall[]
  slidesCreated: number
  usage: AiRunTokenUsage | null
  finishReason: FinishReason | null
  errorMessage: string | null
  hadError: boolean
}

const collectCodexEvent = (options: {
  event: AiRunEvent
  runStartedAt: number
  accumulator: AiRunAccumulator
  onEvent: (event: AiRunEvent) => void
}) => {
  const { event, runStartedAt, accumulator, onEvent } = options
  if (event.type === 'text') accumulator.assistantOutput += event.delta
  else if (event.type === 'reasoning') accumulator.reasoningOutput += event.delta
  else if (event.type === 'tool') {
    accumulator.toolCalls.push({
      name: event.name,
      detail: event.detail,
      offsetMs: Date.now() - runStartedAt,
    })
  } else if (event.type === 'slide-started') {
    accumulator.slidesCreated = event.index + 1
  } else if (event.type === 'done') {
    accumulator.assistantOutput = event.summary
    accumulator.slidesCreated = event.slidesCreated
    accumulator.finishReason = 'stop'
  }
  onEvent(event)
}

const collectStreamPart = <TOOLS extends ToolSet>(options: {
  part: TextStreamPart<TOOLS>
  selection: AiModelSelection
  runStartedAt: number
  accumulator: AiRunAccumulator
  onEvent: (event: AiRunEvent) => void
}) => {
  const { part, selection, runStartedAt, accumulator, onEvent } = options
  // The SDK emits transport events that do not affect the visible activity log.
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
  switch (part.type) {
    case 'text-delta':
      accumulator.assistantOutput += part.text
      onEvent({ type: 'text', delta: part.text })
      break
    case 'reasoning-delta':
      accumulator.reasoningOutput += part.text
      onEvent({ type: 'reasoning', delta: part.text })
      break
    case 'tool-call': {
      if (part.toolName === 'declare_plan') {
        const screens = parsePlanInput(part.input)
        if (screens.length > 0) onEvent({ type: 'plan', screens })
      }
      if (part.toolName === 'add_slide') {
        onEvent({ type: 'slide-started', index: accumulator.slidesCreated })
        accumulator.slidesCreated += 1
      }
      const detail = describeAiToolCall(part.toolName, part.input)
      accumulator.toolCalls.push({
        name: part.toolName,
        detail,
        offsetMs: Date.now() - runStartedAt,
      })
      onEvent({ type: 'tool', name: part.toolName, detail })
      break
    }
    case 'finish':
      accumulator.usage = toAiRunTokenUsage(part.totalUsage)
      accumulator.finishReason = part.finishReason
      break
    case 'error':
      accumulator.hadError = true
      accumulator.errorMessage = describeError(part.error, selection)
      onEvent({ type: 'error', message: accumulator.errorMessage })
      break
    default:
      break
  }
}

/**
 * Releases assistant prose and reasoning one word at a time.
 *
 * Thinking models emit reasoning in large blocks — Gemini often a whole paragraph
 * per chunk — so the run band would otherwise jump a paragraph at a time instead of
 * reading as a stream. The transform sits downstream of step execution and flushes
 * its buffer the moment a non-prose part (a tool call) arrives, so the pacing shapes
 * only what the band renders and never holds up the run.
 *
 * 18ms is a little under typical model output speed, which keeps the crawl smooth
 * without letting it fall behind the model.
 */
export const NARRATION_WORD_DELAY_MS = 18

export const narrationSmoothing = () => smoothStream<ToolSet>({ delayInMs: NARRATION_WORD_DELAY_MS })

const openAiGenerationStream = (options: {
  model: Awaited<ReturnType<typeof createAiModel>>
  selection: AiModelSelection
  controller: AiEditorController
  content: UserContent[]
  targetSlideId?: string
  enableOverlayAssets?: boolean
  signal?: AbortSignal
  onActivity?: (activity: AiToolActivity) => void
}) => {
  const {
    model,
    selection,
    controller,
    content,
    targetSlideId,
    enableOverlayAssets,
    signal,
    onActivity,
  } = options
  const runController = targetSlideId
    ? scopeAiControllerToSlide(controller, targetSlideId)
    : controller
  const requestOptions = buildStreamRequestOptions(selection, uid('shotluma-run'))

  return streamText({
    model,
    instructions: buildInstructions({
      ...(targetSlideId ? { targetSlideId } : {}),
      ...(enableOverlayAssets ? { enableOverlayAssets: true } : {}),
    }),
    messages: [{ role: 'user', content }],
    tools: createEditorTools(runController, {
      mode: targetSlideId ? 'edit' : 'generate',
      ...(onActivity ? { onActivity } : {}),
      ...(enableOverlayAssets ? { enableOverlayAssets: true } : {}),
      ...(signal ? { abortSignal: signal } : {}),
    }),
    stopWhen: isStepCount(64),
    experimental_transform: narrationSmoothing(),
    ...requestOptions,
    // Anthropic caches nothing without explicit breakpoints; keep one moving
    // breakpoint on the last message so every step reuses the whole prefix.
    ...(selection.provider === 'anthropic'
      ? {
          prepareStep: ({ messages }: { messages: ModelMessage[] }) => ({
            messages: withMovingAnthropicCacheBreakpoint(messages),
          }),
        }
      : {}),
    ...(signal ? { abortSignal: signal } : {}),
  })
}

const runCodexProviderGeneration = async (options: {
  selection: AiModelSelection
  description: string
  screenshots: PreparedAsset[]
  appName?: string
  logo?: PreparedAsset
  controller: AiEditorController
  targetSlideId?: string
  enableOverlayAssets?: boolean
  signal?: AbortSignal
  runStartedAt: number
  accumulator: AiRunAccumulator
  onEvent: (event: AiRunEvent) => void
  onActivity?: (activity: AiToolActivity) => void
}) => {
  const connection = readCodexConnection()
  if (!connection) {
    throw new Error('Connect Codex to Shotluma before generating with your ChatGPT plan')
  }
  await runCodexAppServerGeneration({
    connection,
    selection: options.selection,
    description: options.description,
    screenshots: options.screenshots,
    ...(options.appName !== undefined ? { appName: options.appName } : {}),
    ...(options.logo ? { logo: options.logo } : {}),
    controller: options.controller,
    ...(options.targetSlideId ? { targetSlideId: options.targetSlideId } : {}),
    ...(options.enableOverlayAssets ? { enableOverlayAssets: true } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    onEvent: (event) => collectCodexEvent({
      event,
      runStartedAt: options.runStartedAt,
      accumulator: options.accumulator,
      onEvent: options.onEvent,
    }),
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
  })
}

const runDirectProviderGeneration = async (options: {
  selection: AiModelSelection
  description: string
  screenshots: PreparedAsset[]
  appName?: string
  logo?: PreparedAsset
  controller: AiEditorController
  targetSlideId?: string
  enableOverlayAssets?: boolean
  signal?: AbortSignal
  runStartedAt: number
  accumulator: AiRunAccumulator
  onEvent: (event: AiRunEvent) => void
  onActivity?: (activity: AiToolActivity) => void
}): Promise<AiRunReport['outcome']> => {
  const {
    selection,
    description,
    screenshots,
    appName,
    logo,
    controller,
    targetSlideId,
    enableOverlayAssets,
    signal,
    runStartedAt,
    accumulator,
    onEvent,
    onActivity,
  } = options
  const provider = getAiProvider(selection.provider)
  const modelOption = getAiModel(selection)
  const reasoning = getAiSdkReasoningEffort(selection)
  const model = await createAiModel(selection)
  const content = buildUserContent({
    description,
    screenshots,
    ...(appName !== undefined ? { appName } : {}),
    ...(logo ? { logo } : {}),
    ...(targetSlideId ? { targetSlideId } : {}),
  })

  onEvent({
    type: 'status',
    message: `Connecting to ${[
      provider.label,
      modelOption.label,
      ...(reasoning ? [`${AI_REASONING_EFFORT_LABELS[reasoning]} effort`] : []),
    ].join(' · ')}…`,
  })

  const result = openAiGenerationStream({
    model,
    selection,
    controller,
    content,
    ...(targetSlideId ? { targetSlideId } : {}),
    ...(enableOverlayAssets ? { enableOverlayAssets: true } : {}),
    ...(signal ? { signal } : {}),
    ...(onActivity ? { onActivity } : {}),
  })

  for await (const part of result.stream) {
    if (signal?.aborted) break
    collectStreamPart({
      part,
      selection,
      runStartedAt,
      accumulator,
      onEvent,
    })
  }

  if (signal?.aborted) {
    onEvent({ type: 'status', message: 'Cancelled' })
    return 'cancelled'
  }
  if (accumulator.hadError) return 'failed'

  let finalText = accumulator.assistantOutput.trim()
  try {
    const resolvedText = await result.text
    if (resolvedText.trim().length > 0) finalText = resolvedText.trim()
  } catch {
    // fall back to accumulated deltas below
  }

  if (!accumulator.usage) {
    try {
      accumulator.usage = toAiRunTokenUsage(await result.usage)
    } catch {
      // Some providers omit usage even when the text stream completes.
    }
  }
  if (!accumulator.finishReason) {
    try {
      accumulator.finishReason = await result.finishReason
    } catch {
      // The visible completion remains valid if finish metadata is unavailable.
    }
  }

  accumulator.assistantOutput = finalText
  onEvent({
    type: 'done',
    summary: finalText,
    slidesCreated: accumulator.slidesCreated,
  })
  return 'completed'
}

export async function runAiGeneration(options: {
  selection: AiModelSelection
  description: string
  screenshots: PreparedAsset[]
  appName?: string
  logo?: PreparedAsset
  controller: AiEditorController
  targetSlideId?: string
  enableOverlayAssets?: boolean
  signal?: AbortSignal
  onEvent: (event: AiRunEvent) => void
  onActivity?: (activity: AiToolActivity) => void
}): Promise<void> {
  const {
    selection,
    description,
    screenshots,
    appName,
    logo,
    controller,
    targetSlideId,
    enableOverlayAssets,
    signal,
    onEvent,
    onActivity,
  } = options
  const runStartedAt = Date.now()
  const accumulator: AiRunAccumulator = {
    assistantOutput: '',
    reasoningOutput: '',
    toolCalls: [],
    slidesCreated: 0,
    usage: null,
    finishReason: null,
    errorMessage: null,
    hadError: false,
  }

  const finishRun = async (outcome: AiRunReport['outcome']) => {
    const report: AiRunReport = {
      outcome,
      assistantOutput: accumulator.assistantOutput,
      reasoningOutput: accumulator.reasoningOutput,
      toolCalls: accumulator.toolCalls.map((toolCall) => ({ ...toolCall })),
      slidesCreated: accumulator.slidesCreated,
      usage: accumulator.usage,
      finishReason: accumulator.finishReason,
      errorMessage: accumulator.errorMessage,
    }
    await saveAiRunReport({
      startedAt: runStartedAt,
      finishedAt: Date.now(),
      mode: targetSlideId ? 'edit' : 'generate',
      selection,
      descriptionCharacters: description.length,
      screenshotCount: screenshots.length,
      report,
    })
  }

  try {
    if (selection.provider === 'codex') {
      await runCodexProviderGeneration({
        selection,
        description,
        screenshots,
        ...(appName !== undefined ? { appName } : {}),
        ...(logo ? { logo } : {}),
        controller,
        ...(targetSlideId ? { targetSlideId } : {}),
        ...(enableOverlayAssets ? { enableOverlayAssets: true } : {}),
        ...(signal ? { signal } : {}),
        runStartedAt,
        accumulator,
        onEvent,
        ...(onActivity ? { onActivity } : {}),
      })
      await finishRun('completed')
      return
    }
    const outcome = await runDirectProviderGeneration({
      selection,
      description,
      screenshots,
      ...(appName !== undefined ? { appName } : {}),
      ...(logo ? { logo } : {}),
      controller,
      ...(targetSlideId ? { targetSlideId } : {}),
      ...(enableOverlayAssets ? { enableOverlayAssets: true } : {}),
      ...(signal ? { signal } : {}),
      runStartedAt,
      accumulator,
      onEvent,
      ...(onActivity ? { onActivity } : {}),
    })
    await finishRun(outcome)
  } catch (error) {
    if (isAbortError(error)) {
      onEvent({ type: 'status', message: 'Cancelled' })
      await finishRun('cancelled')
      return
    }
    accumulator.errorMessage = describeError(error, selection)
    onEvent({ type: 'error', message: accumulator.errorMessage })
    await finishRun('failed')
  }
}

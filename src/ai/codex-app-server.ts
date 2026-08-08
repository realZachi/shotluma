import { asSchema, type ToolExecutionOptions, type ToolSet } from 'ai'
import { CodexBridgeClient, type CodexRpcMessage } from './codex-bridge-client'
import { scopeAiControllerToSlide, type AiEditorController } from './controller'
import { buildInstructions, buildUserMessage } from './prompt'
import { getAiModel, type AiModelSelection } from './provider-catalog'
import { parsePlanInput } from './run-plan'
import { describeAiToolCall } from './tool-call-description'
import { createEditorTools } from './tools'
import type { CodexConnection } from './codex-connection'
import type { AiRunEvent } from './run-events'
import type { AiToolActivity } from './tools'

export type CodexAccountState =
  | { status: 'connected'; email: string | null; planType: string }
  | { status: 'signedOut' }
  | { status: 'apiKey' }
  | { status: 'unsupported' }

type PreparedAsset = { assetId: string; name: string; dataUrl: string }

type CodexRpcClient = {
  connect: (signal?: AbortSignal) => Promise<{
    appServerReady: boolean
    appServerError: string | null
  }>
  request: (method: string, params: unknown, signal?: AbortSignal) => Promise<unknown>
  respond: (id: string | number, result: unknown) => Promise<void>
  subscribe: (listener: (message: CodexRpcMessage) => void) => () => void
  close: () => void
}

type DynamicToolSpec = {
  type: 'function'
  name: string
  description: string
  inputSchema: unknown
}

type DynamicToolRequest = {
  requestId: string | number
  callId: string
  threadId: string
  turnId: string
  toolName: string
  arguments: unknown
}

type CodexInput =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; detail: 'high' }

type CodexNarrationEvent = Extract<
  AiRunEvent,
  { type: 'text' | 'reasoning' | 'narration-boundary' }
>

type CodexNarrationUpdate = {
  source: 'text' | 'reasoning'
  segmentId: string
  delta?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const parseCodexAccountState = (value: unknown): CodexAccountState => {
  if (!isObject(value)) return { status: 'unsupported' }
  const account = value['account']
  if (account === null) return { status: 'signedOut' }
  if (!isObject(account) || typeof account['type'] !== 'string') {
    return { status: 'unsupported' }
  }
  if (account['type'] === 'apiKey') return { status: 'apiKey' }
  if (account['type'] !== 'chatgpt' || typeof account['planType'] !== 'string') {
    return { status: 'unsupported' }
  }
  return {
    status: 'connected',
    email: typeof account['email'] === 'string' ? account['email'] : null,
    planType: account['planType'],
  }
}

export const readCodexAccountState = async (options: {
  connection: CodexConnection
  signal?: AbortSignal
  client?: CodexRpcClient
}): Promise<CodexAccountState> => {
  const client = options.client ?? new CodexBridgeClient(options.connection)
  try {
    const status = await client.connect(options.signal)
    if (!status.appServerReady) {
      throw new Error(status.appServerError ?? 'Codex App Server is still starting')
    }
    return parseCodexAccountState(await client.request('account/read', {
      refreshToken: false,
    }, options.signal))
  } finally {
    client.close()
  }
}

export const createCodexDynamicToolSpecs = async (
  tools: ToolSet,
): Promise<DynamicToolSpec[]> => {
  const specs: DynamicToolSpec[] = []
  for (const [name, tool] of Object.entries(tools)) {
    if (typeof tool.description !== 'string' || !('inputSchema' in tool)) continue
    specs.push({
      type: 'function',
      name,
      description: tool.description,
      inputSchema: await asSchema(tool.inputSchema).jsonSchema,
    })
  }
  return specs
}

const parseDynamicToolRequest = (message: CodexRpcMessage): DynamicToolRequest | null => {
  if (message['method'] !== 'item/tool/call') return null
  const requestId = message['id']
  const params = message['params']
  if (
    (typeof requestId !== 'string' && typeof requestId !== 'number')
    || !isObject(params)
    || typeof params['callId'] !== 'string'
    || typeof params['threadId'] !== 'string'
    || typeof params['turnId'] !== 'string'
    || typeof params['tool'] !== 'string'
  ) return null
  return {
    requestId,
    callId: params['callId'],
    threadId: params['threadId'],
    turnId: params['turnId'],
    toolName: params['tool'],
    arguments: params['arguments'],
  }
}

const serializeToolOutput = (output: unknown): {
  success: boolean
  contentItems: ({ type: 'inputText'; text: string } | { type: 'inputImage'; imageUrl: string })[]
} => {
  if (isObject(output) && typeof output['image'] === 'string') {
    const mediaType = typeof output['mediaType'] === 'string' ? output['mediaType'] : 'image/jpeg'
    const textOutput = Object.fromEntries(
      Object.entries(output).filter(([key]) => key !== 'image' && key !== 'mediaType'),
    )
    return {
      success: true,
      contentItems: [
        { type: 'inputText', text: JSON.stringify(textOutput) },
        { type: 'inputImage', imageUrl: `data:${mediaType};base64,${output['image']}` },
      ],
    }
  }
  return {
    success: true,
    contentItems: [{
      type: 'inputText',
      text: JSON.stringify(output),
    }],
  }
}

const serializeToolFailure = (error: unknown) => ({
  success: false,
  contentItems: [{
    type: 'inputText' as const,
    text: JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  }],
})

export const executeCodexDynamicTool = async (options: {
  request: DynamicToolRequest
  tools: ToolSet
  signal?: AbortSignal
}) => {
  const tool = Object.hasOwn(options.tools, options.request.toolName)
    ? options.tools[options.request.toolName]
    : undefined
  if (!tool?.execute) {
    return serializeToolFailure(new Error(`Unknown Shotluma tool: ${options.request.toolName}`))
  }
  const executionOptions: ToolExecutionOptions<unknown> = {
    toolCallId: options.request.callId,
    messages: [],
    context: undefined,
    ...(options.signal ? { abortSignal: options.signal } : {}),
  }
  try {
    if (!('inputSchema' in tool)) {
      return serializeToolFailure(new Error(`Shotluma tool has no input schema: ${options.request.toolName}`))
    }
    const schema = asSchema(tool.inputSchema)
    if (!schema.validate) {
      return serializeToolFailure(
        new Error(`Shotluma tool cannot validate input: ${options.request.toolName}`),
      )
    }
    const validation = await schema.validate(options.request.arguments)
    if (!validation.success) {
      return serializeToolFailure(
        new Error(`Invalid input for Shotluma tool ${options.request.toolName}: ${validation.error.message}`),
      )
    }
    const output: unknown = await tool.execute(validation.value, executionOptions)
    if (output && typeof output === 'object' && Symbol.asyncIterator in output) {
      return serializeToolFailure(new Error('Streaming Shotluma tool results are not supported'))
    }
    return serializeToolOutput(output)
  } catch (error) {
    return serializeToolFailure(error)
  }
}

const buildCodexInput = (options: {
  description: string
  screenshots: PreparedAsset[]
  appName?: string
  logo?: PreparedAsset
  targetSlideId?: string
}): CodexInput[] => {
  const input: CodexInput[] = [{
    type: 'text',
    text: buildUserMessage(
      options.description,
      options.screenshots.map(({ assetId, name }) => ({ assetId, name })),
      {
        ...(options.targetSlideId ? { targetSlideId: options.targetSlideId } : {}),
        ...(options.appName?.trim() ? { appName: options.appName.trim() } : {}),
        ...(options.logo ? { logoAssetId: options.logo.assetId } : {}),
      },
    ),
  }]
  for (const screenshot of options.screenshots) {
    input.push({
      type: 'text',
      text: `Screenshot asset "${screenshot.assetId}" (${screenshot.name}):`,
    })
    input.push({ type: 'image', url: screenshot.dataUrl, detail: 'high' })
  }
  if (options.logo) {
    input.push({
      type: 'text',
      text: `App logo asset "${options.logo.assetId}" (${options.logo.name}) — place with add_image, never as a device screenshot:`,
    })
    input.push({ type: 'image', url: options.logo.dataUrl, detail: 'high' })
  }
  return input
}

const readThreadId = (value: unknown): string => {
  if (!isObject(value) || !isObject(value['thread']) || typeof value['thread']['id'] !== 'string') {
    throw new Error('Codex App Server did not return a thread id')
  }
  return value['thread']['id']
}

const readTurnId = (value: unknown): string => {
  if (!isObject(value) || !isObject(value['turn']) || typeof value['turn']['id'] !== 'string') {
    throw new Error('Codex App Server did not return a turn id')
  }
  return value['turn']['id']
}

const parseCodexNarrationUpdate = (message: CodexRpcMessage): CodexNarrationUpdate | null => {
  const params = message['params']
  if (!isObject(params) || typeof params['itemId'] !== 'string') return null
  if (message['method'] === 'item/agentMessage/delta') {
    return typeof params['delta'] === 'string'
      ? { source: 'text', segmentId: `agent:${params['itemId']}`, delta: params['delta'] }
      : null
  }
  if (
    message['method'] !== 'item/reasoning/summaryPartAdded'
    && message['method'] !== 'item/reasoning/summaryTextDelta'
  ) return null
  if (!Number.isSafeInteger(params['summaryIndex'])) return null
  const update: CodexNarrationUpdate = {
    source: 'reasoning',
    segmentId: `reasoning:${params['itemId']}:${String(params['summaryIndex'])}`,
  }
  return message['method'] === 'item/reasoning/summaryTextDelta'
    && typeof params['delta'] === 'string'
    ? { ...update, delta: params['delta'] }
    : update
}

export const createCodexNarrationForwarder = (
  onEvent: (event: CodexNarrationEvent) => void,
): ((message: CodexRpcMessage) => void) => {
  const activeSegments: Record<'text' | 'reasoning', string> = { text: '', reasoning: '' }
  return (message) => {
    const update = parseCodexNarrationUpdate(message)
    if (!update) return
    const previousSegment = activeSegments[update.source]
    if (previousSegment && previousSegment !== update.segmentId) {
      onEvent({ type: 'narration-boundary', source: update.source })
    }
    activeSegments[update.source] = update.segmentId
    if (update.delta) onEvent({ type: update.source, delta: update.delta })
  }
}

const isMatchingTurnMessage = (
  message: CodexRpcMessage,
  threadId: string,
  turnId: string,
): boolean => {
  const params = message['params']
  if (!isObject(params)) return false
  if (typeof params['threadId'] === 'string' && params['threadId'] !== threadId) return false
  if (typeof params['turnId'] === 'string' && params['turnId'] !== turnId) return false
  return true
}

const completedTurnError = (message: CodexRpcMessage): string | null => {
  const params = message['params']
  if (!isObject(params) || !isObject(params['turn'])) return 'Codex turn ended unexpectedly'
  const turn = params['turn']
  if (turn['status'] === 'completed') return null
  if (isObject(turn['error']) && typeof turn['error']['message'] === 'string') {
    return turn['error']['message']
  }
  return turn['status'] === 'interrupted' ? 'Codex generation was cancelled' : 'Codex generation failed'
}

const createAbortError = () => new DOMException('The Codex run was cancelled', 'AbortError')
const THREAD_CLEANUP_TIMEOUT_MS = 1_500

const deleteCodexThread = async (client: CodexRpcClient, threadId: string): Promise<void> => {
  const cleanupController = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      cleanupController.abort()
      resolve()
    }, THREAD_CLEANUP_TIMEOUT_MS)
  })
  const deletion = client.request(
    'thread/delete',
    { threadId },
    cleanupController.signal,
  ).then(() => undefined, () => undefined)
  try {
    await Promise.race([deletion, timeout])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

type CodexGenerationOptions = {
  connection: CodexConnection
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
  client?: CodexRpcClient
}

const createCodexRunTools = (options: CodexGenerationOptions) => {
  const controller = options.targetSlideId
    ? scopeAiControllerToSlide(options.controller, options.targetSlideId)
    : options.controller
  return createEditorTools(controller, {
    mode: options.targetSlideId ? 'edit' : 'generate',
    ...(options.onActivity ? { onActivity: options.onActivity } : {}),
    ...(options.enableOverlayAssets ? { enableOverlayAssets: true } : {}),
    ...(options.signal ? { abortSignal: options.signal } : {}),
  })
}

export const runCodexAppServerGeneration = async (
  options: CodexGenerationOptions,
): Promise<void> => {
  if (options.signal?.aborted) throw createAbortError()
  const client = options.client ?? new CodexBridgeClient(options.connection)
  const tools = createCodexRunTools(options)
  let threadId = ''
  let turnId = ''
  let assistantOutput = ''
  let slidesCreated = 0
  let queuedMessages: CodexRpcMessage[] = []
  let settleTurn: ((error?: Error) => void) | null = null
  const turnCompleted = new Promise<void>((resolve, reject) => {
    settleTurn = (error) => error ? reject(error) : resolve()
  })
  const forwardNarration = createCodexNarrationForwarder((event) => {
    if (event.type === 'text') assistantOutput += event.delta
    options.onEvent(event)
  })

  const handleToolRequest = async (request: DynamicToolRequest) => {
    if (request.threadId !== threadId || request.turnId !== turnId) return
    if (request.toolName === 'declare_plan') {
      const screens = parsePlanInput(request.arguments)
      if (screens.length > 0) options.onEvent({ type: 'plan', screens })
    }
    if (request.toolName === 'add_slide') {
      options.onEvent({ type: 'slide-started', index: slidesCreated })
      slidesCreated += 1
    }
    options.onEvent({
      type: 'tool',
      name: request.toolName,
      detail: describeAiToolCall(request.toolName, request.arguments),
    })
    const result = await executeCodexDynamicTool({
      request,
      tools,
      ...(options.signal ? { signal: options.signal } : {}),
    })
    await client.respond(request.requestId, result)
  }

  const handleMessage = (message: CodexRpcMessage) => {
    const toolRequest = parseDynamicToolRequest(message)
    if (toolRequest) {
      void handleToolRequest(toolRequest).catch((error: unknown) => {
        settleTurn?.(error instanceof Error ? error : new Error(String(error)))
      })
      return
    }
    if (!threadId || !turnId || !isMatchingTurnMessage(message, threadId, turnId)) return
    if (
      message['method'] === 'item/agentMessage/delta'
      || message['method'] === 'item/reasoning/summaryPartAdded'
      || message['method'] === 'item/reasoning/summaryTextDelta'
    ) {
      forwardNarration(message)
      return
    }
    if (message['method'] !== 'turn/completed') return
    const error = completedTurnError(message)
    settleTurn?.(error ? new Error(error) : undefined)
  }

  const unsubscribe = client.subscribe((message) => {
    if (!threadId || !turnId) {
      queuedMessages.push(message)
      return
    }
    handleMessage(message)
  })

  const handleAbort = () => {
    if (!threadId || !turnId) return
    void client.request('turn/interrupt', { threadId, turnId }).catch(() => undefined)
    settleTurn?.(createAbortError())
  }
  options.signal?.addEventListener('abort', handleAbort, { once: true })
  if (options.signal?.aborted) handleAbort()

  try {
    const bridgeStatus = await client.connect(options.signal)
    if (!bridgeStatus.appServerReady) {
      throw new Error(bridgeStatus.appServerError ?? 'Codex App Server is still starting')
    }
    const account = parseCodexAccountState(await client.request(
      'account/read',
      { refreshToken: false },
      options.signal,
    ))
    if (account.status === 'signedOut') {
      throw new Error('Codex is signed out. Run codex login with ChatGPT, then check the connection again.')
    }
    if (account.status === 'apiKey') {
      throw new Error('Codex is using an API key. Sign in with ChatGPT to use your subscription in Shotluma.')
    }
    if (account.status !== 'connected') throw new Error('Shotluma could not verify the Codex account')

    options.onEvent({
      type: 'status',
      message: `Connecting to Codex · ChatGPT ${account.planType}…`,
    })
    const model = getAiModel(options.selection)
    threadId = readThreadId(await client.request('thread/start', {
      model: model.providerModelId ?? model.id,
      ephemeral: true,
      baseInstructions: buildInstructions({
        ...(options.targetSlideId ? { targetSlideId: options.targetSlideId } : {}),
        ...(options.enableOverlayAssets ? { enableOverlayAssets: true } : {}),
      }),
      developerInstructions: 'You are embedded in Shotluma. Use only the provided Shotluma dynamic tools. Never use shell, filesystem, network, MCP, skills, plugins, or subagents.',
      dynamicTools: await createCodexDynamicToolSpecs(tools),
    }, options.signal))
    const turnResult = await client.request('turn/start', {
      threadId,
      input: buildCodexInput({
        description: options.description,
        screenshots: options.screenshots,
        ...(options.appName !== undefined ? { appName: options.appName } : {}),
        ...(options.logo ? { logo: options.logo } : {}),
        ...(options.targetSlideId ? { targetSlideId: options.targetSlideId } : {}),
      }),
      model: model.providerModelId ?? model.id,
      ...(options.selection.reasoningEffort
        ? { effort: options.selection.reasoningEffort }
        : {}),
      summary: 'detailed',
    }, options.signal)
    turnId = readTurnId(turnResult)
    const bufferedMessages = queuedMessages
    queuedMessages = []
    for (const message of bufferedMessages) handleMessage(message)
    if (options.signal?.aborted) handleAbort()
    await turnCompleted
    options.onEvent({
      type: 'done',
      summary: assistantOutput.trim(),
      slidesCreated,
    })
  } finally {
    options.signal?.removeEventListener('abort', handleAbort)
    unsubscribe()
    queuedMessages = []
    if (threadId) {
      await deleteCodexThread(client, threadId)
    }
    client.close()
  }
}

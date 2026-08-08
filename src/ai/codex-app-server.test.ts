import { tool } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  createCodexNarrationForwarder,
  createCodexDynamicToolSpecs,
  executeCodexDynamicTool,
  parseCodexAccountState,
  runCodexAppServerGeneration,
} from './codex-app-server'
import type { CodexRpcMessage } from './codex-bridge-client'
import type { AiEditorController } from './controller'
import type { AiModelSelection } from './provider-catalog'

const connection = {
  version: 1 as const,
  pairingToken: 'A'.repeat(43),
  appOrigin: 'https://app.shotluma.com',
}

const selection: AiModelSelection = {
  provider: 'codex',
  model: 'codex/gpt-5.6-terra',
  reasoningEffort: 'high',
}

const createController = (): AiEditorController => ({
  snapshot: () => ({
    canvas: { width: 1290, height: 2796, coordinates: 'percent' },
    slides: [],
    assets: [],
  }),
  addSlide: () => 'slide-1',
  renameSlide: () => true,
  setSlideBackground: () => true,
  deleteSlide: () => true,
  addElement: () => 'element-1',
  updateElement: () => true,
  deleteElement: () => true,
  getAssetSrc: () => undefined,
  addAsset: () => 'asset-1',
})

type RequestHandler = (
  method: string,
  params: unknown,
  signal: AbortSignal | undefined,
  emit: (message: CodexRpcMessage) => void,
) => unknown

const createClient = (handler?: RequestHandler) => {
  const listeners = new Set<(message: CodexRpcMessage) => void>()
  const requests: { method: string; params: unknown }[] = []
  const emit = (message: CodexRpcMessage) => {
    for (const listener of listeners) listener(message)
  }
  const request = vi.fn(async (method: string, params: unknown, signal?: AbortSignal) => {
    requests.push({ method, params })
    if (handler) return handler(method, params, signal, emit)
    if (method === 'account/read') {
      return { account: { type: 'chatgpt', email: null, planType: 'plus' } }
    }
    if (method === 'thread/start') return { thread: { id: 'thread-1' } }
    if (method === 'turn/start') return { turn: { id: 'turn-1' } }
    return {}
  })
  return {
    client: {
      connect: async () => ({ appServerReady: true, appServerError: null }),
      request,
      respond: vi.fn(async () => undefined),
      subscribe: (listener: (message: CodexRpcMessage) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      close: vi.fn(),
    },
    emit,
    requests,
  }
}

const baseGenerationOptions = () => ({
  connection,
  selection,
  description: 'Create a clean product story.',
  screenshots: [],
  controller: createController(),
  onEvent: vi.fn(),
})

describe('Codex App Server adapter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('distinguishes ChatGPT subscription auth from API-key auth', () => {
    expect(parseCodexAccountState({ account: null })).toEqual({ status: 'signedOut' })
    expect(parseCodexAccountState({ account: { type: 'apiKey' } })).toEqual({
      status: 'apiKey',
    })
    expect(parseCodexAccountState({
      account: { type: 'chatgpt', email: 'user@example.com', planType: 'plus' },
    })).toEqual({
      status: 'connected',
      email: 'user@example.com',
      planType: 'plus',
    })
  })

  it('converts existing AI SDK tools into App Server dynamic tools', async () => {
    const specs = await createCodexDynamicToolSpecs({
      add_label: tool({
        description: 'Add a label to the canvas.',
        inputSchema: z.object({ text: z.string() }),
        execute: async ({ text }) => ({ ok: true, text }),
      }),
    })
    expect(specs).toHaveLength(1)
    expect(specs[0]).toMatchObject({
      type: 'function',
      name: 'add_label',
      description: 'Add a label to the canvas.',
    })
    expect(JSON.stringify(specs[0]?.inputSchema)).toContain('"text"')
  })

  it('preserves Codex reasoning and message segment boundaries while streaming', () => {
    const events: unknown[] = []
    const forward = createCodexNarrationForwarder((event) => events.push(event))

    forward({
      method: 'item/reasoning/summaryPartAdded',
      params: { itemId: 'reasoning-1', summaryIndex: 0 },
    })
    forward({
      method: 'item/reasoning/summaryTextDelta',
      params: { itemId: 'reasoning-1', summaryIndex: 0, delta: '**Planning**' },
    })
    forward({
      method: 'item/reasoning/summaryPartAdded',
      params: { itemId: 'reasoning-1', summaryIndex: 1 },
    })
    forward({
      method: 'item/reasoning/summaryTextDelta',
      params: { itemId: 'reasoning-1', summaryIndex: 1, delta: '**Building**' },
    })
    forward({
      method: 'item/agentMessage/delta',
      params: { itemId: 'message-1', delta: 'First message' },
    })
    forward({
      method: 'item/agentMessage/delta',
      params: { itemId: 'message-2', delta: 'Second message' },
    })

    expect(events).toEqual([
      { type: 'reasoning', delta: '**Planning**' },
      { type: 'narration-boundary', source: 'reasoning' },
      { type: 'reasoning', delta: '**Building**' },
      { type: 'text', delta: 'First message' },
      { type: 'narration-boundary', source: 'text' },
      { type: 'text', delta: 'Second message' },
    ])
  })

  it('validates dynamic tool arguments before executing editor mutations', async () => {
    const execute = vi.fn(async ({ text }: { text: string }) => ({ ok: true, text }))
    const result = await executeCodexDynamicTool({
      request: {
        requestId: 'request-1',
        callId: 'call-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        toolName: 'add_label',
        arguments: { text: 42 },
      },
      tools: {
        add_label: tool({
          description: 'Add a label.',
          inputSchema: z.object({ text: z.string() }),
          execute,
        }),
      },
    })

    expect(result).toMatchObject({ success: false })
    expect(JSON.stringify(result)).toContain('Invalid input for Shotluma tool add_label')
    expect(execute).not.toHaveBeenCalled()
  })

  it('replays turn events delivered in the same batch as the turn response', async () => {
    const { client } = createClient((method, _params, _signal, emit) => {
      if (method === 'account/read') {
        return { account: { type: 'chatgpt', email: null, planType: 'plus' } }
      }
      if (method === 'thread/start') return { thread: { id: 'thread-1' } }
      if (method === 'turn/start') {
        emit({
          method: 'item/agentMessage/delta',
          params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'message-1', delta: 'Done.' },
        })
        emit({
          method: 'turn/completed',
          params: { threadId: 'thread-1', turnId: 'turn-1', turn: { status: 'completed' } },
        })
        return { turn: { id: 'turn-1' } }
      }
      return {}
    })
    const options = baseGenerationOptions()

    await runCodexAppServerGeneration({ ...options, client })

    expect(options.onEvent).toHaveBeenCalledWith({ type: 'text', delta: 'Done.' })
    expect(options.onEvent).toHaveBeenCalledWith({
      type: 'done',
      summary: 'Done.',
      slidesCreated: 0,
    })
  })

  it('interrupts a turn when cancellation lands before the turn id is assigned', async () => {
    const abortController = new AbortController()
    let markTurnStarted: (() => void) | null = null
    const turnStarted = new Promise<void>((resolve) => {
      markTurnStarted = resolve
    })
    const { client, requests } = createClient((method) => {
      if (method === 'account/read') {
        return { account: { type: 'chatgpt', email: null, planType: 'plus' } }
      }
      if (method === 'thread/start') return { thread: { id: 'thread-1' } }
      if (method === 'turn/start') {
        markTurnStarted?.()
        return { turn: { id: 'turn-1' } }
      }
      return {}
    })
    const generation = runCodexAppServerGeneration({
      ...baseGenerationOptions(),
      signal: abortController.signal,
      client,
    })

    await turnStarted
    abortController.abort()

    await expect(generation).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toContainEqual({
      method: 'turn/interrupt',
      params: { threadId: 'thread-1', turnId: 'turn-1' },
    })
  })

  it('forwards overlay asset support into Codex instructions and dynamic tools', async () => {
    const { client, requests } = createClient((method, _params, _signal, emit) => {
      if (method === 'account/read') {
        return { account: { type: 'chatgpt', email: null, planType: 'plus' } }
      }
      if (method === 'thread/start') return { thread: { id: 'thread-1' } }
      if (method === 'turn/start') {
        emit({
          method: 'turn/completed',
          params: { threadId: 'thread-1', turnId: 'turn-1', turn: { status: 'completed' } },
        })
        return { turn: { id: 'turn-1' } }
      }
      return {}
    })

    await runCodexAppServerGeneration({
      ...baseGenerationOptions(),
      enableOverlayAssets: true,
      client,
    })

    const threadStart = requests.find((request) => request.method === 'thread/start')
    const serializedParams = JSON.stringify(threadStart?.params)
    expect(serializedParams).toContain('"name":"create_overlay_asset"')
    expect(serializedParams).toContain('overlay')
  })

  it('closes the client when thread deletion does not answer', async () => {
    vi.useFakeTimers()
    let markDeleteStarted: (() => void) | null = null
    const deleteStarted = new Promise<void>((resolve) => {
      markDeleteStarted = resolve
    })
    const { client } = createClient((method, _params, _signal, emit) => {
      if (method === 'account/read') {
        return { account: { type: 'chatgpt', email: null, planType: 'plus' } }
      }
      if (method === 'thread/start') return { thread: { id: 'thread-1' } }
      if (method === 'turn/start') {
        emit({
          method: 'turn/completed',
          params: { threadId: 'thread-1', turnId: 'turn-1', turn: { status: 'completed' } },
        })
        return { turn: { id: 'turn-1' } }
      }
      if (method === 'thread/delete') {
        markDeleteStarted?.()
        return new Promise<never>(() => undefined)
      }
      return {}
    })
    const generation = runCodexAppServerGeneration({ ...baseGenerationOptions(), client })

    await deleteStarted
    await vi.advanceTimersByTimeAsync(1_500)
    await generation

    expect(client.close).toHaveBeenCalledOnce()
  })
})

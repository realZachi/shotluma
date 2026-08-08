import {
  CODEX_BRIDGE_ORIGIN,
  type CodexConnection,
} from './codex-connection'

export const CODEX_BRIDGE_VERSION = 1

export type CodexBridgeStatus = {
  bridgeVersion: number
  appServerReady: boolean
  appServerError: string | null
  sequence: number
}

export type CodexRpcMessage = Record<string, unknown>
export type CodexBridgeMessageListener = (message: CodexRpcMessage) => void

type Fetcher = typeof fetch
type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  cleanup: () => void
}

// Safari/WebKit rejects an extracted `window.fetch` when it is later invoked
// with another receiver. Keep the platform call attached to globalThis.
const defaultFetcher: Fetcher = (input, init) => globalThis.fetch(input, init)

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const authorizedHeaders = (connection: CodexConnection): Record<string, string> => ({
  Authorization: `Bearer ${connection.pairingToken}`,
})

const parseStatus = (value: unknown): CodexBridgeStatus => {
  if (!isObject(value) || typeof value['bridgeVersion'] !== 'number') {
    throw new Error('The Shotluma Codex Bridge returned an invalid status')
  }
  const appServer = value['appServer']
  if (
    !isObject(appServer)
    || typeof appServer['ready'] !== 'boolean'
    || typeof appServer['sequence'] !== 'number'
    || (appServer['error'] !== null && typeof appServer['error'] !== 'string')
  ) throw new Error('The Shotluma Codex Bridge returned an invalid App Server status')
  if (value['bridgeVersion'] !== CODEX_BRIDGE_VERSION) {
    throw new Error(
      `Shotluma Codex Bridge version ${String(value['bridgeVersion'])} is incompatible; run the setup prompt again`,
    )
  }
  return {
    bridgeVersion: value['bridgeVersion'],
    appServerReady: appServer['ready'],
    appServerError: appServer['error'],
    sequence: appServer['sequence'],
  }
}

const responseError = async (response: Response): Promise<Error> => {
  let detail = ''
  try {
    const value: unknown = await response.json()
    if (isObject(value) && typeof value['error'] === 'string') detail = `: ${value['error']}`
  } catch {
    // HTTP status remains actionable when the response is not JSON.
  }
  return new Error(`Shotluma Codex Bridge request failed (${response.status})${detail}`)
}

export const probeCodexBridge = async (options: {
  connection: CodexConnection
  fetcher?: Fetcher
  signal?: AbortSignal
}): Promise<CodexBridgeStatus> => {
  const fetcher = options.fetcher ?? defaultFetcher
  const response = await fetcher(`${CODEX_BRIDGE_ORIGIN}/v1/status`, {
    headers: authorizedHeaders(options.connection),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    ...(options.signal ? { signal: options.signal } : {}),
  })
  if (!response.ok) throw await responseError(response)
  return parseStatus(await response.json())
}

const parseEventBatch = (value: unknown): {
  events: { sequence: number; message: CodexRpcMessage }[]
  sequence: number
  droppedThrough: number
} => {
  if (!isObject(value) || !Array.isArray(value['events']) || typeof value['sequence'] !== 'number') {
    throw new Error('The Shotluma Codex Bridge returned an invalid event batch')
  }
  const droppedThrough = value['droppedThrough'] ?? 0
  if (!Number.isSafeInteger(droppedThrough) || Number(droppedThrough) < 0) {
    throw new Error('The Shotluma Codex Bridge returned an invalid event range')
  }
  const events: { sequence: number; message: CodexRpcMessage }[] = []
  for (const item of value['events']) {
    if (!isObject(item) || typeof item['sequence'] !== 'number' || !isObject(item['message'])) {
      throw new Error('The Shotluma Codex Bridge returned an invalid event')
    }
    events.push({ sequence: item['sequence'], message: item['message'] })
  }
  return { events, sequence: value['sequence'], droppedThrough: Number(droppedThrough) }
}

const rpcError = (value: unknown): Error => {
  if (!isObject(value)) return new Error('Codex App Server returned an unknown error')
  const message = typeof value['message'] === 'string'
    ? value['message']
    : 'Codex App Server request failed'
  return new Error(message)
}

export class CodexBridgeClient {
  private afterSequence = 0
  private isClosed = false
  private pollController: AbortController | null = null
  private failure: Error | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private listeners = new Set<CodexBridgeMessageListener>()

  constructor(
    private readonly connection: CodexConnection,
    private readonly fetcher: Fetcher = defaultFetcher,
  ) {}

  async connect(signal?: AbortSignal): Promise<CodexBridgeStatus> {
    this.assertAvailable()
    const status = await probeCodexBridge({
      connection: this.connection,
      fetcher: this.fetcher,
      ...(signal ? { signal } : {}),
    })
    this.afterSequence = status.sequence
    if (status.appServerReady) this.startPolling()
    return status
  }

  subscribe(listener: CodexBridgeMessageListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async request(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
    this.assertAvailable()
    if (signal?.aborted) throw new DOMException('The Codex request was cancelled', 'AbortError')
    const id = `shotluma-${crypto.randomUUID()}`
    const result = new Promise<unknown>((resolve, reject) => {
      const handleAbort = () => {
        this.pendingRequests.delete(id)
        reject(new DOMException('The Codex request was cancelled', 'AbortError'))
      }
      signal?.addEventListener('abort', handleAbort, { once: true })
      this.pendingRequests.set(id, {
        resolve,
        reject,
        cleanup: () => signal?.removeEventListener('abort', handleAbort),
      })
    })
    try {
      const [, value] = await Promise.all([
        this.postMessage({ id, method, params }, signal),
        result,
      ])
      return value
    } catch (error) {
      const pending = this.pendingRequests.get(id)
      pending?.cleanup()
      this.pendingRequests.delete(id)
      throw error
    }
  }

  async respond(id: string | number, result: unknown): Promise<void> {
    await this.postMessage({ id, result })
  }

  close() {
    if (this.isClosed) return
    this.isClosed = true
    this.pollController?.abort()
    const error = new Error('The Shotluma Codex Bridge connection closed')
    for (const pending of this.pendingRequests.values()) {
      pending.cleanup()
      pending.reject(error)
    }
    this.pendingRequests.clear()
    this.listeners.clear()
  }

  private async postMessage(message: CodexRpcMessage, signal?: AbortSignal) {
    this.assertAvailable()
    const response = await this.fetcher(`${CODEX_BRIDGE_ORIGIN}/v1/rpc`, {
      method: 'POST',
      headers: {
        ...authorizedHeaders(this.connection),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...(signal ? { signal } : {}),
    })
    if (!response.ok) throw await responseError(response)
  }

  private startPolling() {
    if (this.pollController || this.isClosed) return
    this.pollController = new AbortController()
    void this.pollEvents(this.pollController.signal)
  }

  private async pollEvents(signal: AbortSignal): Promise<void> {
    try {
      while (!signal.aborted && !this.isClosed) {
        const response = await this.fetcher(
          `${CODEX_BRIDGE_ORIGIN}/v1/events?after=${this.afterSequence}`,
          {
            headers: authorizedHeaders(this.connection),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal,
          },
        )
        if (!response.ok) throw await responseError(response)
        const batch = parseEventBatch(await response.json())
        if (this.afterSequence < batch.droppedThrough) {
          throw new Error('The Shotluma Codex Bridge event buffer overflowed; retry the generation')
        }
        this.afterSequence = batch.sequence
        for (const event of batch.events) this.dispatch(event.message)
      }
    } catch (error) {
      if (signal.aborted || this.isClosed) return
      const failure = error instanceof Error ? error : new Error(String(error))
      this.failure = failure
      for (const pending of this.pendingRequests.values()) {
        pending.cleanup()
        pending.reject(failure)
      }
      this.pendingRequests.clear()
    }
  }

  private assertAvailable() {
    if (this.isClosed) throw new Error('The Shotluma Codex Bridge connection is closed')
    if (this.failure) throw this.failure
  }

  private dispatch(message: CodexRpcMessage) {
    const id = message['id']
    if ((typeof id === 'string' || typeof id === 'number') && !('method' in message)) {
      const pending = this.pendingRequests.get(String(id))
      if (pending) {
        pending.cleanup()
        this.pendingRequests.delete(String(id))
        if ('error' in message) pending.reject(rpcError(message['error']))
        else pending.resolve(message['result'])
        return
      }
    }
    for (const listener of this.listeners) listener(message)
  }
}

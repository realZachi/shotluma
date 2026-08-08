import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexBridgeClient, probeCodexBridge } from './codex-bridge-client'
import type { CodexConnection } from './codex-connection'

const connection: CodexConnection = {
  version: 1,
  pairingToken: 'A'.repeat(43),
  appOrigin: 'https://app.shotluma.com',
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('Codex bridge client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the browser Window receiver when using the default fetch', async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(jsonResponse({
        bridgeVersion: 1,
        appServer: { ready: true, error: null, sequence: 3 },
      }))
    })
    vi.stubGlobal('fetch', browserFetch)

    await expect(probeCodexBridge({ connection })).resolves.toMatchObject({
      bridgeVersion: 1,
      appServerReady: true,
    })
    expect(browserFetch).toHaveBeenCalledOnce()
  })

  it('validates the bridge and App Server status response', async () => {
    const fetcher = async () => jsonResponse({
      bridgeVersion: 1,
      appServer: { ready: true, error: null, sequence: 7 },
    })
    await expect(probeCodexBridge({ connection, fetcher })).resolves.toEqual({
      bridgeVersion: 1,
      appServerReady: true,
      appServerError: null,
      sequence: 7,
    })

    await expect(probeCodexBridge({
      connection,
      fetcher: async () => jsonResponse({ ready: true }),
    })).rejects.toThrow('invalid status')

    await expect(probeCodexBridge({
      connection,
      fetcher: async () => jsonResponse({
        bridgeVersion: 2,
        appServer: { ready: true, error: null, sequence: 0 },
      }),
    })).rejects.toThrow('version 2 is incompatible')
  })

  it('rejects a pre-aborted request without starting a fetch', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const controller = new AbortController()
    controller.abort()
    const client = new CodexBridgeClient(connection, fetcher)

    await expect(client.request('account/read', {}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('matches an App Server response to its pending request', async () => {
    let requestId = ''
    let eventDelivered = false
    let deliverEvent: (() => void) | null = null
    const waitForAbort = (signal: AbortSignal | null) => new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
        once: true,
      })
    })
    const fetcher: typeof fetch = async (input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (url.endsWith('/v1/status')) {
        return jsonResponse({
          bridgeVersion: 1,
          appServer: { ready: true, error: null, sequence: 0 },
        })
      }
      if (url.endsWith('/v1/rpc')) {
        if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body')
        const body: unknown = JSON.parse(init.body)
        if (body && typeof body === 'object' && 'id' in body) requestId = String(body.id)
        deliverEvent?.()
        return jsonResponse({ accepted: true }, 202)
      }
      if (!eventDelivered) {
        await new Promise<void>((resolve) => {
          deliverEvent = resolve
        })
        eventDelivered = true
        return jsonResponse({
          events: [{ sequence: 1, message: { id: requestId, result: { ok: true } } }],
          sequence: 1,
        })
      }
      return waitForAbort(init?.signal ?? null)
    }

    const client = new CodexBridgeClient(connection, fetcher)
    await client.connect()
    await expect(client.request('account/read', {})).resolves.toEqual({ ok: true })
    client.close()
  })

  it('rejects pending and future requests after the event poll fails', async () => {
    let failPoll!: (response: Response) => void
    const pollResponse = new Promise<Response>((resolve) => {
      failPoll = resolve
    })
    const fetcher: typeof fetch = async (input) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (url.endsWith('/v1/status')) {
        return jsonResponse({
          bridgeVersion: 1,
          appServer: { ready: true, error: null, sequence: 0 },
        })
      }
      if (url.includes('/v1/events')) return pollResponse
      return jsonResponse({ accepted: true }, 202)
    }
    const client = new CodexBridgeClient(connection, fetcher)
    await client.connect()
    const pending = client.request('account/read', {})

    failPoll(jsonResponse({ error: 'Codex App Server stopped' }, 503))

    await expect(pending).rejects.toThrow('Codex App Server stopped')
    await expect(client.request('model/list', {})).rejects.toThrow('Codex App Server stopped')
    client.close()
  })

  it('fails fast when the bridge reports evicted events', async () => {
    let deliverBatch!: (response: Response) => void
    const eventBatch = new Promise<Response>((resolve) => {
      deliverBatch = resolve
    })
    const fetcher: typeof fetch = async (input) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
      if (url.endsWith('/v1/status')) {
        return jsonResponse({
          bridgeVersion: 1,
          appServer: { ready: true, error: null, sequence: 0 },
        })
      }
      if (url.includes('/v1/events')) return eventBatch
      return jsonResponse({ accepted: true }, 202)
    }
    const client = new CodexBridgeClient(connection, fetcher)
    await client.connect()
    const pending = client.request('account/read', {})

    deliverBatch(jsonResponse({ events: [], sequence: 4, droppedThrough: 3 }))

    await expect(pending).rejects.toThrow('event buffer overflowed')
    client.close()
  })

  it('rejects an in-flight request when the client closes', async () => {
    const client = new CodexBridgeClient(
      connection,
      async () => jsonResponse({ accepted: true }, 202),
    )
    const pending = client.request('account/read', {})

    client.close()

    await expect(pending).rejects.toThrow('connection closed')
  })
})

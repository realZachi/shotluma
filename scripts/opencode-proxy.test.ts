import { describe, expect, it, vi } from 'vitest'
import {
  copyOpencodeProxyHeaders,
  isOpencodeProxyMethod,
  proxyOpencodeRequest,
  rewriteOpencodeProxyUrl,
} from './opencode-proxy'

describe('OpenCode CORS proxy rewrite', () => {
  it('maps Zen and Go prefixes onto the public OpenCode origins', () => {
    expect(rewriteOpencodeProxyUrl(
      new URL('https://app.shotluma.com/api/opencode/zen/v1/chat/completions'),
    )?.toString()).toBe('https://opencode.ai/zen/v1/chat/completions')
    expect(rewriteOpencodeProxyUrl(
      new URL('https://app.shotluma.com/api/opencode/go/v1/models?foo=1'),
    )?.toString()).toBe('https://opencode.ai/zen/go/v1/models?foo=1')
    expect(rewriteOpencodeProxyUrl(
      new URL('https://app.shotluma.com/api/opencode/zen'),
    )?.toString()).toBe('https://opencode.ai/zen/')
    expect(rewriteOpencodeProxyUrl(
      new URL('https://app.shotluma.com/api/moonshot/v1/chat/completions'),
    )).toBeNull()
  })

  it('does not treat a zen path as go', () => {
    expect(rewriteOpencodeProxyUrl(
      new URL('https://app.shotluma.com/api/opencode/zen/v1/models'),
    )?.toString()).toBe('https://opencode.ai/zen/v1/models')
  })
})

describe('OpenCode CORS proxy headers and methods', () => {
  it('forwards only the allowlisted request headers', () => {
    const headers = copyOpencodeProxyHeaders(new Headers({
      authorization: 'Bearer test-key',
      'content-type': 'application/json',
      accept: 'text/event-stream',
      cookie: 'session=secret',
      host: 'app.shotluma.com',
    }))
    expect(Object.fromEntries(headers.entries())).toEqual({
      authorization: 'Bearer test-key',
      'content-type': 'application/json',
      accept: 'text/event-stream',
    })
  })

  it('allows GET, POST, and OPTIONS only', () => {
    expect(isOpencodeProxyMethod('get')).toBe(true)
    expect(isOpencodeProxyMethod('POST')).toBe(true)
    expect(isOpencodeProxyMethod('OPTIONS')).toBe(true)
    expect(isOpencodeProxyMethod('PUT')).toBe(false)
  })

  it('answers OPTIONS without contacting OpenCode', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await proxyOpencodeRequest(new Request(
      'https://app.shotluma.com/api/opencode/zen/v1/models',
      { method: 'OPTIONS' },
    ))
    expect(response.status).toBe(204)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('rejects unsupported methods and unknown paths', async () => {
    expect((await proxyOpencodeRequest(new Request(
      'https://app.shotluma.com/api/opencode/zen/v1/models',
      { method: 'DELETE' },
    ))).status).toBe(405)
    expect((await proxyOpencodeRequest(new Request(
      'https://app.shotluma.com/api/moonshot/v1/models',
      { method: 'GET' },
    ))).status).toBe(404)
  })

  it('forwards GET and POST to the rewritten OpenCode origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const getResponse = await proxyOpencodeRequest(new Request(
      'https://app.shotluma.com/api/opencode/go/v1/models',
      { method: 'GET', headers: { authorization: 'Bearer test-key' } },
    ))
    expect(getResponse.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [getUrl, getInit] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(getUrl.toString()).toBe('https://opencode.ai/zen/go/v1/models')
    expect(getInit.method).toBe('GET')
    expect(getInit.body).toBeUndefined()

    await proxyOpencodeRequest(new Request(
      'https://app.shotluma.com/api/opencode/zen/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"model":"kimi-k3"}',
      },
    ))
    const [, postInit] = fetchMock.mock.calls[1] as [URL, RequestInit & { duplex?: string }]
    expect(postInit.method).toBe('POST')
    expect(postInit.body).toBeDefined()
    expect(postInit.duplex).toBe('half')
    vi.unstubAllGlobals()
  })
})

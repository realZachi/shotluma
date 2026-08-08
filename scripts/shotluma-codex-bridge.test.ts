import { describe, expect, it } from 'vitest'
import {
  isAuthorizedBridgeRequest,
  parseBridgeCommand,
  restrictRpcMessage,
} from './shotluma-codex-bridge'

const token = 'A'.repeat(43)

describe('Shotluma Codex Bridge', () => {
  it('parses and normalizes the start command', () => {
    expect(parseBridgeCommand([
      'start',
      '--pairing-token',
      token,
      '--allowed-origin',
      'https://app.shotluma.com/setup',
    ])).toEqual({
      type: 'start',
      pairingToken: token,
      allowedOrigin: 'https://app.shotluma.com',
    })
    expect(() => parseBridgeCommand([
      'start',
      '--pairing-token',
      'short',
      '--allowed-origin',
      'https://app.shotluma.com',
    ])).toThrow('pairing token')
    expect(() => parseBridgeCommand([
      'start',
      '--pairing-token',
      token,
      '--allowed-origin',
      'http://app.shotluma.com',
    ])).toThrow('browser origin')
  })

  it('requires both the exact origin and bearer pairing token', () => {
    const config = { pairingToken: token, allowedOrigin: 'https://app.shotluma.com' }
    expect(isAuthorizedBridgeRequest({
      requestOrigin: 'https://app.shotluma.com',
      authorization: `Bearer ${token}`,
      config,
    })).toBe(true)
    expect(isAuthorizedBridgeRequest({
      requestOrigin: 'https://evil.example',
      authorization: `Bearer ${token}`,
      config,
    })).toBe(false)
    expect(isAuthorizedBridgeRequest({
      requestOrigin: 'https://app.shotluma.com',
      authorization: `Bearer ${'B'.repeat(43)}`,
      config,
    })).toBe(false)
    expect(isAuthorizedBridgeRequest({
      requestOrigin: undefined,
      authorization: `Bearer ${token}`,
      config,
    })).toBe(false)
    expect(isAuthorizedBridgeRequest({
      requestOrigin: 'https://app.shotluma.com',
      authorization: undefined,
      config,
    })).toBe(false)
    expect(isAuthorizedBridgeRequest({
      requestOrigin: 'https://app.shotluma.com',
      authorization: `Basic ${token}`,
      config,
    })).toBe(false)
  })

  it('allows only the minimal RPC surface and forces a non-writing sandbox', () => {
    expect(restrictRpcMessage({
      id: '1',
      method: 'thread/shellCommand',
      params: { command: 'cat ~/.codex/auth.json' },
    })).toBeNull()
    expect(restrictRpcMessage({
      id: '2',
      method: 'thread/start',
      params: { sandbox: 'danger-full-access', approvalPolicy: 'on-request' },
    })).toMatchObject({
      params: {
        sandbox: 'read-only',
        approvalPolicy: 'never',
        serviceName: 'shotluma',
      },
    })
    expect(restrictRpcMessage({
      id: '3',
      method: 'turn/start',
      params: { sandboxPolicy: { type: 'dangerFullAccess' } },
    })).toMatchObject({
      params: {
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
        approvalPolicy: 'never',
      },
    })
    expect(restrictRpcMessage({ id: 'server-request', result: { success: true } })).toEqual({
      id: 'server-request',
      result: { success: true },
    })
    expect(restrictRpcMessage({
      id: 'unknown',
      method: 'thread/notARealMethod',
      params: {},
    })).toBeNull()
    expect(restrictRpcMessage({ method: 'account/read', params: {} })).toBeNull()
  })
})

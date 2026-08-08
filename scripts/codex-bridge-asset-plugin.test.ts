import { describe, expect, it } from 'vitest'
import { buildCodexBridgeAsset } from './codex-bridge-asset-plugin'

describe('Codex bridge asset', () => {
  it('emits a standalone Node-compatible module without TypeScript declarations', async () => {
    const source = await buildCodexBridgeAsset()
    expect(source).toContain('Shotluma Codex Bridge')
    expect(source).toContain('from "node:child_process"')
    expect(source).not.toContain('export type BridgeCommand')
    expect(source).not.toContain(': BridgeConfig')
  })
})

import { tool } from 'ai'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createCodexNarrationForwarder,
  createCodexDynamicToolSpecs,
  parseCodexAccountState,
} from './codex-app-server'

describe('Codex App Server adapter', () => {
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
})

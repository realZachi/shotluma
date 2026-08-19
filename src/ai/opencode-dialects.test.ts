import { describe, expect, it } from 'vitest'
import {
  opencodeDialectNeedsChatToolImageRelay,
  opencodeModelDialect,
  opencodeSelectionDialect,
} from './opencode-dialects'

describe('OpenCode dialect routing', () => {
  it('routes GPT, Grok, and Muse Spark to the Responses endpoint', () => {
    expect(opencodeModelDialect('opencode-zen', 'gpt-5.6-terra')).toBe('responses')
    expect(opencodeModelDialect('opencode-go', 'gpt-5.6-luna')).toBe('responses')
    expect(opencodeModelDialect('opencode-go', 'grok-4.5')).toBe('responses')
    expect(opencodeModelDialect('opencode-zen', 'grok-4.6')).toBe('responses')
    expect(opencodeModelDialect('opencode-go', 'muse-spark-1.2-contributor'))
      .toBe('responses')
  })

  it('routes Claude and Qwen to the Anthropic messages endpoint', () => {
    expect(opencodeModelDialect('opencode-zen', 'claude-sonnet-5')).toBe('messages')
    expect(opencodeModelDialect('opencode-zen', 'qwen3.7-max')).toBe('messages')
    expect(opencodeModelDialect('opencode-go', 'qwen3.8-max')).toBe('messages')
  })

  it('routes Gemini to the Google endpoint', () => {
    expect(opencodeModelDialect('opencode-zen', 'gemini-3.7-flash')).toBe('google')
  })

  it('keeps the open-weight families and unknown ids on chat completions', () => {
    expect(opencodeModelDialect('opencode-zen', 'kimi-k3')).toBe('chat')
    expect(opencodeModelDialect('opencode-go', 'mimo-v2.5')).toBe('chat')
    expect(opencodeModelDialect('opencode-go', 'glm-5.3')).toBe('chat')
    expect(opencodeModelDialect('opencode-zen', 'deepseek-v4-pro')).toBe('chat')
    expect(opencodeModelDialect('opencode-zen', 'hy3-free')).toBe('chat')
    expect(opencodeModelDialect('opencode-go', 'some-future-open-model')).toBe('chat')
  })

  it('splits MiniMax by gateway because Zen and Go disagree', () => {
    expect(opencodeModelDialect('opencode-zen', 'minimax-m2.5')).toBe('chat')
    expect(opencodeModelDialect('opencode-go', 'minimax-m3')).toBe('messages')
  })

  it('resolves a selection and ignores non-OpenCode providers', () => {
    expect(opencodeSelectionDialect({
      provider: 'opencode-go',
      model: 'opencode-go/gpt-5.6-luna',
    })).toBe('responses')
    expect(opencodeSelectionDialect({
      provider: 'opencode-zen',
      model: 'opencode-zen/kimi-k3',
    })).toBe('chat')
    expect(opencodeSelectionDialect({ provider: 'openai', model: 'gpt-5.6-terra' }))
      .toBeNull()
  })

  it('relays tool images only on the chat-completions dialect', () => {
    expect(opencodeDialectNeedsChatToolImageRelay('chat')).toBe(true)
    expect(opencodeDialectNeedsChatToolImageRelay('responses')).toBe(false)
    expect(opencodeDialectNeedsChatToolImageRelay('messages')).toBe(false)
    expect(opencodeDialectNeedsChatToolImageRelay('google')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildStreamRequestOptions,
  withMovingCacheBreakpoint,
  withMovingAnthropicCacheBreakpoint,
  withStaticInstructionCacheBreakpoint,
} from './prompt-caching'
import type { ModelMessage } from 'ai'

describe('buildStreamRequestOptions', () => {
  it('adds the prompt cache key next to a portable reasoning effort for OpenAI', () => {
    const options = buildStreamRequestOptions(
      { provider: 'openai', model: 'gpt-5.6-luna', reasoningEffort: 'high' },
      'run-key-1',
    )

    expect(options).toEqual({
      reasoning: 'high',
      providerOptions: {
        openai: {
          promptCacheKey: 'run-key-1',
          promptCacheOptions: { mode: 'implicit', ttl: '30m' },
        },
      },
    })
  })

  it('merges the prompt cache key into the OpenAI max-effort provider options', () => {
    const options = buildStreamRequestOptions(
      { provider: 'openai', model: 'gpt-5.6-sol', reasoningEffort: 'max' },
      'run-key-2',
    )

    expect(options).toEqual({
      providerOptions: {
        openai: {
          reasoningEffort: 'max',
          promptCacheKey: 'run-key-2',
          promptCacheOptions: { mode: 'implicit', ttl: '30m' },
        },
      },
    })
  })

  it('never sends the cache key to Moonshot despite the shared OpenAI namespace', () => {
    const options = buildStreamRequestOptions(
      { provider: 'moonshot', model: 'kimi-k3', reasoningEffort: 'max' },
      'run-key-3',
    )

    expect(options).toEqual({
      providerOptions: { openai: { reasoningEffort: 'max' } },
    })
  })

  it('passes non-OpenAI reasoning options through untouched', () => {
    const options = buildStreamRequestOptions(
      { provider: 'anthropic', model: 'claude-sonnet-5', reasoningEffort: 'medium' },
      'run-key-4',
    )

    expect(options).toEqual({ reasoning: 'medium' })
  })

  it('includes the default reasoning effort when none is explicitly selected', () => {
    const options = buildStreamRequestOptions(
      { provider: 'google', model: 'gemini-3.6-flash' },
      'run-key-5',
    )

    // gemini-3.6-flash supports 'high' (the default), so it's auto-selected
    expect(options.reasoning).toBe('high')
  })

  /**
   * Google reads `includeThoughts` only from its own provider options — the portable
   * `reasoning` value has no fallback for it. Without this, Gemini thinks, bills the
   * tokens, and returns no thought summaries at all.
   */
  it('always asks Google for thought summaries', () => {
    const options = buildStreamRequestOptions(
      { provider: 'google', model: 'gemini-3.6-flash', reasoningEffort: 'medium' },
      'run-key-6',
    )

    expect(options).toEqual({
      reasoning: 'medium',
      providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
    })
  })

  it('asks for thought summaries on every Gemini model in the catalog', () => {
    for (const model of ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview']) {
      const options = buildStreamRequestOptions({ provider: 'google', model }, 'run-key-7')

      expect(options.providerOptions?.google).toEqual({ thinkingConfig: { includeThoughts: true } })
    }
  })

  it('never sends Google a thinking level that would override the effort choice', () => {
    const options = buildStreamRequestOptions(
      { provider: 'google', model: 'gemini-3.6-flash', reasoningEffort: 'low' },
      'run-key-8',
    )

    expect(options.providerOptions?.google?.thinkingConfig).toEqual({ includeThoughts: true })
    expect(options.reasoning).toBe('low')
  })

  it('does not send Google options to other providers', () => {
    const options = buildStreamRequestOptions(
      { provider: 'openai', model: 'gpt-5.6-luna', reasoningEffort: 'high' },
      'run-key-9',
    )

    expect(options.providerOptions?.google).toBeUndefined()
  })
})

describe('withStaticInstructionCacheBreakpoint', () => {
  it('marks the stable OpenAI instruction prefix explicitly', () => {
    expect(withStaticInstructionCacheBreakpoint('Stable instructions', 'openai')).toEqual({
      role: 'system',
      content: 'Stable instructions',
      providerOptions: {
        openai: { promptCacheBreakpoint: { mode: 'explicit' } },
      },
    })
  })

  it('marks Anthropic and Alibaba instructions with their native cache control', () => {
    expect(withStaticInstructionCacheBreakpoint('Stable', 'anthropic')).toMatchObject({
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    })
    expect(withStaticInstructionCacheBreakpoint('Stable', 'qwen')).toMatchObject({
      providerOptions: {
        alibaba: { cacheControl: { type: 'ephemeral' } },
      },
    })
  })

  it('leaves providers without explicit instruction caching unchanged', () => {
    expect(withStaticInstructionCacheBreakpoint('Stable', 'google')).toBe('Stable')
  })
})

describe('withMovingAnthropicCacheBreakpoint', () => {
  const user = (text: string): ModelMessage => ({ role: 'user', content: text })

  it('marks only the last message with an ephemeral cache breakpoint', () => {
    const marked = withMovingAnthropicCacheBreakpoint([
      user('first'),
      user('second'),
    ])

    expect(marked[0]?.providerOptions).toBeUndefined()
    expect(marked[1]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('strips breakpoints carried forward from earlier steps', () => {
    const previouslyMarked: ModelMessage = {
      role: 'user',
      content: 'older',
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    }

    const marked = withMovingAnthropicCacheBreakpoint([
      previouslyMarked,
      user('newest'),
    ])

    expect(marked[0]?.providerOptions).toBeUndefined()
    expect(marked[1]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  it('preserves unrelated provider options while stripping the breakpoint', () => {
    const message: ModelMessage = {
      role: 'assistant',
      content: 'reply',
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' }, other: 'kept' },
        openai: { itemId: 'msg_1' },
      },
    }

    const marked = withMovingAnthropicCacheBreakpoint([message, user('last')])

    expect(marked[0]?.providerOptions).toEqual({
      anthropic: { other: 'kept' },
      openai: { itemId: 'msg_1' },
    })
  })

  it('keeps existing anthropic options on the marked last message', () => {
    const message: ModelMessage = {
      role: 'user',
      content: 'last',
      providerOptions: { anthropic: { other: 'kept' } },
    }

    const marked = withMovingAnthropicCacheBreakpoint([message])

    expect(marked[0]?.providerOptions).toEqual({
      anthropic: { other: 'kept', cacheControl: { type: 'ephemeral' } },
    })
  })

  it('does not mutate the input messages', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'older',
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      user('newest'),
    ]

    withMovingAnthropicCacheBreakpoint(messages)

    expect(messages[0]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
    expect(messages[1]?.providerOptions).toBeUndefined()
  })

  it('handles an empty message list', () => {
    expect(withMovingAnthropicCacheBreakpoint([])).toEqual([])
  })

  it('applies the same moving pattern to Alibaba without touching Anthropic options', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: 'older',
        providerOptions: {
          alibaba: { cacheControl: { type: 'ephemeral' } },
          anthropic: { other: 'kept' },
        },
      },
      user('newest'),
    ]

    const marked = withMovingCacheBreakpoint(messages, 'alibaba')

    expect(marked[0]?.providerOptions).toEqual({ anthropic: { other: 'kept' } })
    expect(marked[1]?.providerOptions).toEqual({
      alibaba: { cacheControl: { type: 'ephemeral' } },
    })
  })
})

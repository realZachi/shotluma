import { describe, expect, it } from 'vitest'
import {
  AI_RUN_LOG_SCHEMA_VERSION,
  AI_RUN_LOG_TEXT_LIMIT,
  createAiRunLog,
  normalizeAiRunLog,
  toAiRunTokenUsage,
  type AiRunReport,
} from './run-log'
import type { LanguageModelUsage } from 'ai'

const sdkUsage: LanguageModelUsage = {
  inputTokens: 120,
  inputTokenDetails: {
    noCacheTokens: 100,
    cacheReadTokens: 20,
    cacheWriteTokens: undefined,
  },
  outputTokens: 45,
  outputTokenDetails: {
    textTokens: 30,
    reasoningTokens: 15,
  },
  totalTokens: 165,
  raw: {
    providerRequestId: 'must-not-be-persisted',
  },
}

const completedReport: AiRunReport = {
  outcome: 'completed',
  assistantOutput: 'Created three screens.',
  reasoningOutput: 'Inspecting the layout.',
  toolCalls: [{
    name: 'inspect_slide',
    detail: 'Layout measured',
    offsetMs: 125,
  }],
  steps: [{
    usage: toAiRunTokenUsage(sdkUsage),
    toolCallCount: 1,
    previewCount: 0,
  }],
  slidesCreated: 3,
  usage: toAiRunTokenUsage(sdkUsage),
  finishReason: 'stop',
  errorMessage: null,
}

const createLog = () => createAiRunLog({
  id: 'ai-run-1',
  startedAt: Date.UTC(2026, 6, 23, 10),
  finishedAt: Date.UTC(2026, 6, 23, 10, 0, 2),
  mode: 'generate',
  selection: { provider: 'openai', model: 'gpt-test' },
  descriptionCharacters: 42,
  screenshotCount: 2,
  report: completedReport,
})

describe('AI run logs', () => {
  it('normalizes SDK usage without persisting raw provider metadata', () => {
    const usage = toAiRunTokenUsage(sdkUsage)

    expect(usage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      textTokens: 30,
      reasoningTokens: 15,
      noCacheTokens: 100,
      cacheReadTokens: 20,
      cacheWriteTokens: null,
    })
    expect(JSON.stringify(usage)).not.toContain('providerRequestId')
  })

  it('stores request sizes instead of prompt or screenshot contents', () => {
    const log = createLog()

    expect(log).toMatchObject({
      schemaVersion: AI_RUN_LOG_SCHEMA_VERSION,
      startedAt: '2026-07-23T10:00:00.000Z',
      durationMs: 2000,
      provider: 'openai',
      model: 'gpt-test',
      reasoningEffort: 'high',
      request: {
        descriptionCharacters: 42,
        screenshotCount: 2,
      },
      outcome: 'completed',
      finishReason: 'stop',
      steps: [{ toolCallCount: 1, previewCount: 0 }],
    })
    expect(JSON.stringify(log)).not.toContain('data:image')
    expect(JSON.stringify(log)).not.toContain('providerRequestId')
  })

  it('bounds persisted output text and invalid numeric metadata', () => {
    const oversizedOutput = 'x'.repeat(AI_RUN_LOG_TEXT_LIMIT + 1)
    const log = createAiRunLog({
      id: 'ai-run-bounded',
      startedAt: 1000,
      finishedAt: 500,
      mode: 'edit',
      selection: {
        provider: 'google',
        model: 'gemini-test',
        reasoningEffort: 'high',
      },
      descriptionCharacters: Number.NaN,
      screenshotCount: -2,
      report: {
        ...completedReport,
        assistantOutput: oversizedOutput,
        slidesCreated: -1,
      },
    })

    expect(log.durationMs).toBe(0)
    expect(log.request).toEqual({
      descriptionCharacters: 0,
      screenshotCount: 0,
    })
    expect(log.slidesCreated).toBe(0)
    expect(log.reasoningEffort).toBe('high')
    expect(log.assistantOutputTruncated).toBe(true)
    expect(log.assistantOutput).toContain('[truncated by Shotluma]')
    expect(log.reasoningOutputTruncated).toBe(false)
  })

  it('normalizes valid stored records and rejects malformed records', () => {
    const validLog = createLog()

    expect(normalizeAiRunLog(JSON.parse(JSON.stringify(validLog)))).toEqual(validLog)
    expect(normalizeAiRunLog(null)).toBeNull()
    expect(normalizeAiRunLog({ ...validLog, schemaVersion: 1 })).toBeNull()
    expect(normalizeAiRunLog({ ...validLog, provider: 'unknown' })).toBeNull()
    expect(normalizeAiRunLog({ ...validLog, startedAt: 'not-a-date' })).toBeNull()
    expect(normalizeAiRunLog({
      ...validLog,
      request: { descriptionCharacters: -1, screenshotCount: 2 },
    })).toBeNull()
    expect(normalizeAiRunLog({
      ...validLog,
      toolCalls: [{ name: 'inspect_slide', detail: 'Layout measured', offsetMs: -1 }],
    })).toBeNull()
    expect(normalizeAiRunLog({
      ...validLog,
      steps: [{ ...validLog.steps[0], previewCount: -1 }],
    })).toBeNull()
    expect(normalizeAiRunLog({
      ...validLog,
      usage: { ...validLog.usage, inputTokens: '120' },
    })).toBeNull()
    expect(normalizeAiRunLog({ ...validLog, finishReason: 'unexpected' })).toBeNull()
  })

  it('accepts unavailable usage for failed and cancelled runs', () => {
    const failedLog = {
      ...createLog(),
      outcome: 'failed',
      usage: null,
      finishReason: null,
      errorMessage: 'Provider unavailable',
    }

    expect(normalizeAiRunLog(failedLog)).toEqual(failedLog)
  })
})

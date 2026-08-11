import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAiRunLog, type AiRunReport } from '../src/ai/run-log'
import {
  createAiRunLogFilename,
  writeAiRunLogFile,
} from './ai-run-log-plugin'

const report: AiRunReport = {
  outcome: 'completed',
  assistantOutput: 'Created a screen.',
  reasoningOutput: 'Checked the layout.',
  toolCalls: [{
    name: 'inspect_slide',
    detail: 'Layout measured',
    offsetMs: 25,
  }],
  steps: [{
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      textTokens: 15,
      reasoningTokens: 5,
      noCacheTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    toolCallCount: 1,
    previewCount: 0,
  }],
  slidesCreated: 1,
  usage: {
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    textTokens: 15,
    reasoningTokens: 5,
    noCacheTokens: 100,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  finishReason: 'stop',
  errorMessage: null,
}

const createLog = (model = 'gpt-test') => createAiRunLog({
  id: 'ai-run-test',
  startedAt: Date.UTC(2026, 6, 23, 12),
  finishedAt: Date.UTC(2026, 6, 23, 12, 0, 1),
  mode: 'generate',
  selection: { provider: 'openai', model },
  descriptionCharacters: 40,
  screenshotCount: 2,
  report,
})

let temporaryRoot: string | null = null

afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  temporaryRoot = null
})

describe('AI run log Vite plugin', () => {
  it('writes a validated log to the project AI log directory', async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'shotluma-ai-log-'))
    const log = createLog()

    const filePath = await writeAiRunLogFile(temporaryRoot, log)

    expect(path.dirname(filePath)).toBe(path.join(temporaryRoot, 'ai-logs'))
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual(log)
  })

  it('creates a filename without allowing model names to escape the log directory', () => {
    const filename = createAiRunLogFilename(createLog('../../GPT Test'))

    expect(filename).toBe(
      '2026-07-23t12-00-00-000z_openai_gpt-test_generate_ai-run-test.json',
    )
    expect(path.basename(filename)).toBe(filename)
  })

  it('rejects malformed browser payloads before writing', async () => {
    temporaryRoot = await mkdtemp(path.join(tmpdir(), 'shotluma-ai-log-'))

    await expect(writeAiRunLogFile(temporaryRoot, {
      ...createLog(),
      provider: 'invalid',
    })).rejects.toThrow('Invalid AI run log payload.')
  })
})

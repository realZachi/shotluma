import { generateText, type FilePart } from 'ai'
import { uid } from '../utils'
import { OPENCODE_VISION_PROMPT, toVisionFilePart } from './describe-images'
import { opencodeModelDialect } from './opencode-dialects'
import type { OpencodeProviderId } from './opencode-models'

/**
 * OpenCode Go and Zen expect a stable session id on every request so the
 * gateway can route traffic and reuse prompt caches:
 * https://opencode.ai/docs/go/#where-can-i-use-it
 *
 * Module scope keeps it stable for the browser session while naturally
 * sharding traffic across clients, matching the lifecycle of
 * PROMPT_CACHE_SESSION_ID in runner.ts.
 */
export const OPENCODE_SESSION_ID = uid('shotluma')

/** Identifies Shotluma traffic to the OpenCode gateways on every request. */
export const opencodeRequestHeaders = (): Record<string, string> => ({
  'x-opencode-session': OPENCODE_SESSION_ID,
})

export const opencodeBaseUrl = (
  providerId: OpencodeProviderId,
  origin: string,
): string =>
  `${origin}/api/opencode/${providerId === 'opencode-go' ? 'go' : 'zen'}/v1`

/**
 * Build a language model for one OpenCode model on the dialect that gateway
 * serves it on. All four dialects share the same proxied base URL; only the
 * provider package and the path it appends differ.
 */
export const createOpencodeModel = async (options: {
  providerId: OpencodeProviderId
  modelId: string
  apiKey: string
  origin?: string
}) => {
  const { providerId, modelId, apiKey } = options
  const baseURL = opencodeBaseUrl(providerId, options.origin ?? window.location.origin)
  switch (opencodeModelDialect(providerId, modelId)) {
    case 'responses': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({ apiKey, baseURL, headers: opencodeRequestHeaders() }).responses(modelId)
    }
    case 'messages': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({ apiKey, baseURL, headers: opencodeRequestHeaders() })(modelId)
    }
    case 'google': {
      const { createGoogle } = await import('@ai-sdk/google')
      return createGoogle({ apiKey, baseURL, headers: opencodeRequestHeaders() })(modelId)
    }
    case 'chat': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({ apiKey, baseURL, headers: opencodeRequestHeaders() }).chat(modelId)
    }
  }
}

export const createOpencodeImageDescriber = (options: {
  providerId: OpencodeProviderId
  visionModelId: string
  apiKey: string
  signal?: AbortSignal
}): ((part: FilePart) => Promise<string>) => {
  let modelPromise: ReturnType<typeof createOpencodeModel> | null = null
  return async (part) => {
    modelPromise ??= createOpencodeModel({
      providerId: options.providerId,
      modelId: options.visionModelId,
      apiKey: options.apiKey,
    })
    const { text } = await generateText({
      model: await modelPromise,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: OPENCODE_VISION_PROMPT },
          toVisionFilePart(part),
        ],
      }],
      ...(options.signal ? { abortSignal: options.signal } : {}),
    })
    return text
  }
}

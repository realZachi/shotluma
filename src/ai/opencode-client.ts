import { generateText, type FilePart } from 'ai'
import { OPENCODE_VISION_PROMPT, toVisionFilePart } from './describe-images'
import { opencodeModelDialect } from './opencode-dialects'
import type { OpencodeProviderId } from './opencode-models'

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
      return createOpenAI({ apiKey, baseURL }).responses(modelId)
    }
    case 'messages': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return createAnthropic({ apiKey, baseURL })(modelId)
    }
    case 'google': {
      const { createGoogle } = await import('@ai-sdk/google')
      return createGoogle({ apiKey, baseURL })(modelId)
    }
    case 'chat': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return createOpenAI({ apiKey, baseURL }).chat(modelId)
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

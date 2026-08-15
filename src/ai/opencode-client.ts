import { generateText, type FilePart } from 'ai'
import { OPENCODE_VISION_PROMPT, toVisionFilePart } from './describe-images'
import {
  opencodeProviderModelId,
  type OpencodeProviderId,
} from './opencode-models'

export const opencodeChatBaseUrl = (
  providerId: OpencodeProviderId,
  origin: string,
): string =>
  `${origin}/api/opencode/${providerId === 'opencode-go' ? 'go' : 'zen'}/v1`

export const createOpencodeChatModel = async (options: {
  providerId: OpencodeProviderId
  modelId: string
  apiKey: string
  origin?: string
}) => {
  const { createOpenAI } = await import('@ai-sdk/openai')
  const origin = options.origin ?? window.location.origin
  return createOpenAI({
    apiKey: options.apiKey,
    baseURL: opencodeChatBaseUrl(options.providerId, origin),
  }).chat(options.modelId)
}

export const createOpencodeImageDescriber = (options: {
  providerId: OpencodeProviderId
  visionModelId: string
  apiKey: string
  signal?: AbortSignal
}): ((part: FilePart) => Promise<string>) => {
  let modelPromise: ReturnType<typeof createOpencodeChatModel> | null = null
  return async (part) => {
    modelPromise ??= createOpencodeChatModel({
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

export const opencodeRequestModelId = (catalogId: string, providerModelId?: string): string =>
  providerModelId ?? opencodeProviderModelId(catalogId)

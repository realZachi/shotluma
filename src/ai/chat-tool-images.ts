import type {
  FilePart,
  ModelMessage,
  ToolContent,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from 'ai'

type ToolResultOutput = ToolResultPart['output']
type ContentToolResultOutput = Extract<ToolResultOutput, { type: 'content' }>
type ContentToolResultPart = ContentToolResultOutput['value'][number]
type ContentFilePart = Extract<ContentToolResultPart, { type: 'file' }>
type ContentTextPart = Extract<ContentToolResultPart, { type: 'text' }>

type CompactToolResult = {
  result: ToolResultPart
  images: FilePart[]
}

const isImageMediaType = (mediaType: string): boolean =>
  mediaType.toLowerCase().startsWith('image/')

const hasPartType = (part: unknown, type: string): part is { type: string } =>
  typeof part === 'object' && part !== null && 'type' in part && part.type === type

const isContentFilePart = (part: unknown): part is ContentFilePart =>
  hasPartType(part, 'file')

const isContentTextPart = (part: unknown): part is ContentTextPart =>
  hasPartType(part, 'text')

const toUserFilePart = (part: ContentFilePart): FilePart => ({
  type: 'file',
  data: part.data,
  mediaType: part.mediaType,
  ...(part.filename === undefined ? {} : { filename: part.filename }),
  ...(part.providerOptions === undefined
    ? {}
    : { providerOptions: part.providerOptions }),
})

const describeFile = (mediaType: string, filename: string | undefined): string =>
  filename === undefined
    ? `[file: ${mediaType}]`
    : `[file: ${mediaType}; filename: ${filename}]`

const compactContentOutput = (output: ContentToolResultOutput): {
  output: ToolResultOutput
  images: FilePart[]
} => {
  const hasFile = output.value.some(isContentFilePart)
  if (!hasFile) return { output, images: [] }

  const images: FilePart[] = []
  const textParts: string[] = []

  for (const part of output.value) {
    if (isContentTextPart(part)) {
      textParts.push(part.text)
      continue
    }
    if (isContentFilePart(part)) {
      if (isImageMediaType(part.mediaType)) images.push(toUserFilePart(part))
      else textParts.push(describeFile(part.mediaType, part.filename))
      continue
    }
    textParts.push('[non-text tool content]')
  }

  return {
    output: {
      type: 'text',
      value: textParts.length > 0
        ? textParts.join('\n')
        : `[${images.length} image${images.length === 1 ? '' : 's'} attached separately]`,
    },
    images,
  }
}

const compactToolResult = (result: ToolResultPart): CompactToolResult => {
  if (result.output.type !== 'content') return { result, images: [] }

  const compacted = compactContentOutput(result.output)
  if (compacted.output === result.output) return { result, images: compacted.images }

  return {
    result: { ...result, output: compacted.output },
    images: compacted.images,
  }
}

const compactToolMessage = (message: ToolModelMessage): {
  message: ToolModelMessage
  images: FilePart[]
} => {
  const images: FilePart[] = []
  let changed = false
  const content: ToolContent = []

  for (const part of message.content) {
    if (part.type !== 'tool-result') {
      content.push(part)
      continue
    }

    const compacted = compactToolResult(part)
    images.push(...compacted.images)
    if (compacted.result !== part) changed = true
    content.push(compacted.result)
  }

  return {
    message: changed ? { ...message, content } : message,
    images,
  }
}

/**
 * Relays image files outside tool-result content for Chat adapters that serialize
 * content outputs as JSON text. Non-image files become compact metadata instead of
 * carrying their data payload into the chat tool result.
 */
export const relayChatToolImages = (messages: ModelMessage[]): ModelMessage[] => {
  const relayed: ModelMessage[] = []
  let changed = false

  for (const message of messages) {
    if (message.role !== 'tool') {
      relayed.push(message)
      continue
    }

    const compacted = compactToolMessage(message)
    relayed.push(compacted.message)
    if (compacted.message !== message) changed = true
    if (compacted.images.length === 0) continue

    const imageMessage: UserModelMessage = {
      role: 'user',
      content: compacted.images,
    }
    relayed.push(imageMessage)
  }

  return changed ? relayed : messages
}

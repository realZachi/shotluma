import type { FilePart, ModelMessage, TextPart } from 'ai'

type LegacyImagePart = {
  type: 'image'
  image: unknown
  mediaType?: string
}

type DescribeablePart = FilePart | LegacyImagePart

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isFilePart = (part: unknown): part is FilePart =>
  isRecord(part) && part['type'] === 'file' && typeof part['mediaType'] === 'string'

const isLegacyImagePart = (part: unknown): part is LegacyImagePart =>
  isRecord(part) && part['type'] === 'image'

const isImageMediaType = (mediaType: string | undefined): boolean =>
  typeof mediaType === 'string' && mediaType.toLowerCase().startsWith('image/')

export const OPENCODE_VISION_PROMPT = `Describe this image for a designer who cannot see it.
Focus on layout, visual hierarchy, colors, typography, exact visible copy, UI elements, icons, device frames, and spacing.
Be concrete and complete. Do not suggest improvements.`

// Two FNV-1a variants over the full payload keep same-length images from
// sharing a cache key without pulling in a hashing dependency.
const hashBytes = (bytes: Uint8Array): string => {
  let a = 0x811c9dc5
  let b = 0x811c9dc5
  for (const byte of bytes) {
    a = Math.imul(a ^ byte, 0x01000193)
    b = Math.imul(b ^ byte, 0x85ebca77)
  }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`
}

const serializeImageData = (data: unknown): string => {
  if (typeof data === 'string') return data
  if (data instanceof URL) return data.toString()
  if (isRecord(data) && data['type'] === 'data') return serializeImageData(data['data'])
  if (isRecord(data) && data['type'] === 'url') return serializeImageData(data['url'])
  if (data instanceof Uint8Array) return `bytes:${data.byteLength}:${hashBytes(data)}`
  if (data instanceof ArrayBuffer) return serializeImageData(new Uint8Array(data))
  return JSON.stringify(data)
}

export const imagePartKey = (part: DescribeablePart): string => {
  if (isFilePart(part)) {
    return `${part.mediaType}:${serializeImageData(part.data)}`
  }
  return `image:${part.mediaType ?? 'image'}:${serializeImageData(part.image)}`
}

const isDescribeablePart = (part: unknown): part is DescribeablePart => {
  if (isLegacyImagePart(part)) return true
  return isFilePart(part) && isImageMediaType(part.mediaType)
}

const collectFromContent = (content: unknown, images: DescribeablePart[]): void => {
  if (!Array.isArray(content)) return
  for (const part of content as unknown[]) {
    if (isDescribeablePart(part)) images.push(part)
  }
}

export const collectMessageImages = (
  messages: readonly ModelMessage[],
): readonly DescribeablePart[] => {
  const images: DescribeablePart[] = []
  for (const message of messages) {
    if (message.role === 'tool') continue
    collectFromContent(message.content, images)
  }
  return images
}

const toDescriptionPart = (description: string): TextPart => ({
  type: 'text',
  text: description.startsWith('[Image')
    ? description
    : `Image description:\n${description}`,
})

const replaceContentImages = (
  content: unknown,
  descriptions: ReadonlyMap<string, string>,
): unknown => {
  if (!Array.isArray(content)) return content
  const parts = content as unknown[]
  const next = parts.map((part) => {
    if (!isDescribeablePart(part)) return part
    const description = descriptions.get(imagePartKey(part))
    if (description === undefined) return part
    return toDescriptionPart(description)
  })
  const changed = next.some((part, index) => part !== parts[index])
  return changed ? next : content
}

export const replaceMessageImages = (
  messages: ModelMessage[],
  descriptions: ReadonlyMap<string, string>,
): ModelMessage[] => {
  if (descriptions.size === 0) return messages
  const next = messages.map((message) => {
    if (message.role === 'tool') return message
    const content = replaceContentImages(message.content, descriptions)
    if (content === message.content) return message
    return { ...message, content } as ModelMessage
  })
  const changed = next.some((message, index) => message !== messages[index])
  return changed ? next : messages
}

/**
 * Replace image file parts with text descriptions so a text-only model can
 * still use screenshots and slide previews. Descriptions are cached by image
 * payload so repeated previews of the same bytes are described once. Pass a
 * shared `cache` to reuse descriptions across calls — each tool-loop step
 * re-prepares the full message history, and describe calls cost tens of
 * seconds each, so re-describing per step would stall every step.
 */
export const describeMessageImages = async (
  messages: ModelMessage[],
  describeImage: (part: FilePart) => Promise<string>,
  cache?: Map<string, string>,
): Promise<ModelMessage[]> => {
  const images = collectMessageImages(messages)
  if (images.length === 0) return messages

  const descriptions = cache ?? new Map<string, string>()
  for (const image of images) {
    const key = imagePartKey(image)
    if (descriptions.has(key)) continue
    try {
      const description = (await describeImage(toVisionFilePart(image))).trim()
      descriptions.set(
        key,
        description.length > 0 ? description : '[Image description was empty]',
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      descriptions.set(key, `[Image could not be described: ${detail}]`)
    }
  }

  return replaceMessageImages(messages, descriptions)
}

export const toVisionFilePart = (part: DescribeablePart): FilePart => {
  if (isFilePart(part)) return part
  const mediaType = part.mediaType ?? 'image/png'
  const image = part.image
  if (image instanceof URL) {
    return { type: 'file', mediaType, data: { type: 'url', url: image } }
  }
  if (
    typeof image === 'string'
    || image instanceof Uint8Array
    || image instanceof ArrayBuffer
  ) {
    return { type: 'file', mediaType, data: { type: 'data', data: image } }
  }
  return { type: 'file', mediaType, data: { type: 'data', data: serializeImageData(image) } }
}

import { describe, expect, it } from 'vitest'
import { relayChatToolImages } from './chat-tool-images'
import type {
  ModelMessage,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from 'ai'

type ToolResultOutput = ToolResultPart['output']
type ContentToolResultOutput = Extract<ToolResultOutput, { type: 'content' }>

const previewImage = (data: string): ContentToolResultOutput['value'][number] => ({
  type: 'file',
  mediaType: 'image/jpeg',
  data: { type: 'data', data },
})

const previewResult = (toolCallId: string, images: string[]): ToolModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId,
      toolName: 'render_slide_preview',
      output: {
        type: 'content',
        value: [
          { type: 'text', text: JSON.stringify({ ok: true, warnings: [] }) },
          ...images.map(previewImage),
        ],
      },
    },
  ],
})

const getToolMessage = (message: ModelMessage | undefined): ToolModelMessage => {
  if (message?.role !== 'tool') throw new Error('Expected a tool message.')
  return message
}

const getUserMessage = (message: ModelMessage | undefined): UserModelMessage => {
  if (message?.role !== 'user') throw new Error('Expected a user message.')
  return message
}

describe('relayChatToolImages', () => {
  it('moves image data out of the Chat tool JSON without mutating the source', () => {
    const base64 = 'aGVsbG8tdmlzdWFsLXJlc3VsdA=='
    const messages: ModelMessage[] = [previewResult('call-preview', [base64])]
    const before = JSON.stringify(messages)

    const relayed = relayChatToolImages(messages)
    const toolMessage = getToolMessage(relayed[0])
    const toolResult = toolMessage.content[0]
    const imageMessage = getUserMessage(relayed[1])

    expect(JSON.stringify(messages)).toBe(before)
    expect(toolResult).toMatchObject({
      type: 'tool-result',
      toolCallId: 'call-preview',
      output: { type: 'text', value: JSON.stringify({ ok: true, warnings: [] }) },
    })
    expect(JSON.stringify(toolMessage)).not.toContain(base64)
    expect(imageMessage.content).toEqual([
      {
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'data', data: base64 },
      },
    ])
  })

  it('leaves text-only tool content unchanged', () => {
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-text',
            toolName: 'inspect_slide',
            output: { type: 'content', value: [{ type: 'text', text: '{"ok":true}' }] },
          },
        ],
      },
    ]

    const relayed = relayChatToolImages(messages)

    expect(relayed).toBe(messages)
    expect(relayed).toEqual(messages)
  })

  it('is idempotent after moving the image files', () => {
    const once = relayChatToolImages([previewResult('call-preview', ['first-image'])])
    const twice = relayChatToolImages(once)

    expect(twice).toBe(once)
    expect(twice).toEqual(once)
  })

  it('preserves tool-result and image order across multiple results and files', () => {
    const first = previewResult('call-first', ['first-a', 'first-b']).content[0]
    const second = previewResult('call-second', ['second-a']).content[0]
    if (first?.type !== 'tool-result' || second?.type !== 'tool-result') {
      throw new Error('Expected tool results.')
    }
    const messages: ModelMessage[] = [{ role: 'tool', content: [first, second] }]

    const relayed = relayChatToolImages(messages)
    const toolMessage = getToolMessage(relayed[0])
    const imageMessage = getUserMessage(relayed[1])

    expect(toolMessage.content.map((part) =>
      part.type === 'tool-result' ? part.toolCallId : part.approvalId,
    )).toEqual(['call-first', 'call-second'])
    if (typeof imageMessage.content === 'string') {
      throw new Error('Expected image content parts.')
    }
    expect(imageMessage.content).toEqual([
      {
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'data', data: 'first-a' },
      },
      {
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'data', data: 'first-b' },
      },
      {
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'data', data: 'second-a' },
      },
    ])
  })

  it('keeps non-image files as metadata without relaying their payload', () => {
    const fileData = 'cGRmLXBheWxvYWQ='
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-document',
            toolName: 'read_document',
            output: {
              type: 'content',
              value: [
                { type: 'text', text: '{"ok":true}' },
                {
                  type: 'file',
                  mediaType: 'application/pdf',
                  filename: 'brief.pdf',
                  data: { type: 'data', data: fileData },
                },
              ],
            },
          },
        ],
      },
    ]

    const relayed = relayChatToolImages(messages)
    const toolMessage = getToolMessage(relayed[0])
    const toolResult = toolMessage.content[0]

    expect(relayed).toHaveLength(1)
    expect(toolResult).toMatchObject({
      output: {
        type: 'text',
        value: '{"ok":true}\n[file: application/pdf; filename: brief.pdf]',
      },
    })
    expect(JSON.stringify(toolMessage)).not.toContain(fileData)
  })
})

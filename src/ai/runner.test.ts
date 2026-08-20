import { describe, expect, it, vi } from 'vitest'
import { prepareGenerationMessages, type OpencodeVisionFallback } from './runner'
import type { ModelMessage } from 'ai'

const textOnlyMessages: ModelMessage[] = [
  { role: 'user', content: 'Design three slides' },
]

const messagesWithUserImage: ModelMessage[] = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'Screenshot:' },
      { type: 'file', mediaType: 'image/png', data: 'data:image/png;base64,abc' },
    ],
  },
]

const messagesWithToolPreview: ModelMessage[] = [
  { role: 'user', content: 'Design three slides' },
  {
    role: 'tool',
    content: [{
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'render_slide_preview',
      output: {
        type: 'content',
        value: [{
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: 'preview-bytes' },
        }],
      },
    }],
  },
]

const prepare = (
  messages: ModelMessage[],
  resolveVisionFallback: (() => OpencodeVisionFallback) | null,
  needsChatImageRelay = false,
) => prepareGenerationMessages({
  messages,
  movingCacheProvider: null,
  needsChatImageRelay,
  resolveVisionFallback,
  visionAnnouncement: { sent: false },
  descriptionCache: new Map(),
})

describe('prepareGenerationMessages', () => {
  it('never resolves the vision fallback for image-free requests', async () => {
    const resolveVisionFallback = vi.fn((): OpencodeVisionFallback => {
      throw new Error('no OpenCode vision model is available')
    })
    const prepared = await prepare(textOnlyMessages, resolveVisionFallback)
    expect(prepared).toBe(textOnlyMessages)
    expect(resolveVisionFallback).not.toHaveBeenCalled()
  })

  it('surfaces the missing-vision-model error once an image appears', async () => {
    const resolveVisionFallback = (): OpencodeVisionFallback => {
      throw new Error('no OpenCode vision model is available')
    }
    await expect(prepare(messagesWithUserImage, resolveVisionFallback))
      .rejects.toThrow('no OpenCode vision model is available')
  })

  it('describes user images through the resolved fallback', async () => {
    const describeImage = vi.fn().mockResolvedValue('a login screen')
    const prepared = await prepare(messagesWithUserImage, () => ({
      describeImage,
      visionLabel: 'MiMo V2.5',
    }))
    expect(describeImage).toHaveBeenCalledTimes(1)
    expect(prepared[0]).toMatchObject({
      content: [
        { type: 'text', text: 'Screenshot:' },
        { type: 'text', text: 'Image description:\na login screen' },
      ],
    })
  })

  it('relays tool preview images for non-chat dialects when the fallback is active', async () => {
    const describeImage = vi.fn().mockResolvedValue('slide preview')
    const prepared = await prepare(messagesWithToolPreview, () => ({
      describeImage,
      visionLabel: 'MiMo V2.5',
    }), false)
    expect(describeImage).toHaveBeenCalledTimes(1)
    const relayedUserMessage = prepared[prepared.length - 1]
    expect(relayedUserMessage).toMatchObject({
      role: 'user',
      content: [{ type: 'text', text: 'Image description:\nslide preview' }],
    })
  })
})

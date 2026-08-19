import { describe, expect, it } from 'vitest'
import {
  collectMessageImages,
  describeMessageImages,
  imagePartKey,
  replaceMessageImages,
  toVisionFilePart,
} from './describe-images'
import type { FilePart, ModelMessage, UserModelMessage } from 'ai'

const filePart = (data: string, mediaType = 'image/png'): FilePart => ({
  type: 'file',
  mediaType,
  data,
})

const userImages = (...parts: FilePart[]): UserModelMessage => ({
  role: 'user',
  content: [{ type: 'text', text: 'Screenshots:' }, ...parts],
})

describe('describeMessageImages', () => {
  it('leaves messages without images unchanged', async () => {
    const messages: ModelMessage[] = [{ role: 'user', content: 'hello' }]
    expect(await describeMessageImages(messages, async () => 'nope')).toBe(messages)
    expect(collectMessageImages(messages)).toEqual([])
  })

  it('replaces image files with text descriptions and skips tool payloads', async () => {
    const shot = filePart('data:image/png;base64,abc')
    const messages: ModelMessage[] = [
      userImages(shot),
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
              mediaType: 'image/jpeg',
              data: { type: 'data', data: 'preview-bytes' },
            }],
          },
        }],
      },
    ]

    const described = await describeMessageImages(messages, async (part) => {
      return part.mediaType === 'image/jpeg' ? 'preview layout' : 'app screenshot'
    })

    expect(collectMessageImages(messages)).toHaveLength(1)
    expect(described[0]).toMatchObject({
      role: 'user',
      content: [
        { type: 'text', text: 'Screenshots:' },
        { type: 'text', text: 'Image description:\napp screenshot' },
      ],
    })
    expect(described[1]).toBe(messages[1])
  })

  it('describes identical payloads once and reports failures as text', async () => {
    const first = filePart('same-bytes')
    const second = filePart('same-bytes')
    const broken = filePart('broken')
    let calls = 0
    const described = await describeMessageImages(
      [userImages(first, second, broken)],
      async (part) => {
        calls += 1
        if (imagePartKey(part).includes('broken')) throw new Error('vision timeout')
        return '  shared view  '
      },
    )

    expect(calls).toBe(2)
    const content = (described[0] as UserModelMessage).content
    if (!Array.isArray(content)) throw new Error('expected parts')
    expect(content.map((part) => 'text' in part ? part.text : '')).toEqual([
      'Screenshots:',
      'Image description:\nshared view',
      'Image description:\nshared view',
      '[Image could not be described: vision timeout]',
    ])
  })

  it('reuses a shared cache across calls instead of re-describing per step', async () => {
    const shot = filePart('step-bytes')
    const cache = new Map<string, string>()
    let calls = 0
    const describeImage = async () => {
      calls += 1
      return 'described once'
    }

    const first = await describeMessageImages([userImages(shot)], describeImage, cache)
    const second = await describeMessageImages([userImages(shot)], describeImage, cache)

    expect(calls).toBe(1)
    for (const described of [first, second]) {
      const content = (described[0] as UserModelMessage).content
      if (!Array.isArray(content)) throw new Error('expected parts')
      expect(content[1]).toEqual({
        type: 'text',
        text: 'Image description:\ndescribed once',
      })
    }
  })

  it('converts legacy image parts for the vision request', () => {
    const converted = toVisionFilePart({
      type: 'image',
      image: 'abc',
      mediaType: 'image/jpeg',
    })
    expect(converted).toEqual({
      type: 'file',
      mediaType: 'image/jpeg',
      data: { type: 'data', data: 'abc' },
    })
    expect(replaceMessageImages([], new Map())).toEqual([])
  })

  it('covers image-part keys, empty descriptions, and tagged data wrappers', async () => {
    const url = new URL('https://example.test/shot.png')
    expect(toVisionFilePart({ type: 'file', mediaType: 'image/png', data: 'kept' })).toEqual({
      type: 'file',
      mediaType: 'image/png',
      data: 'kept',
    })
    expect(toVisionFilePart({
      type: 'image',
      image: url,
    })).toEqual({
      type: 'file',
      mediaType: 'image/png',
      data: { type: 'url', url },
    })
    expect(imagePartKey({
      type: 'file',
      mediaType: 'image/webp',
      data: { type: 'data', data: 'nested' },
    })).toContain('nested')
    expect(imagePartKey({
      type: 'file',
      mediaType: 'image/png',
      data: { type: 'url', url },
    })).toContain('example.test')
    expect(imagePartKey({
      type: 'file',
      mediaType: 'image/png',
      data: new Uint8Array([9, 8, 7]),
    })).toContain('bytes:3:9')
    expect(imagePartKey({
      type: 'image',
      image: 'abc',
      mediaType: 'image/jpeg',
    })).toContain('abc')

    const described = await describeMessageImages(
      [{
        role: 'user',
        content: [
          { type: 'image', image: 'abc', mediaType: 'image/jpeg' },
          { type: 'file', mediaType: 'application/pdf', data: 'not-an-image' },
        ],
      }],
      async () => '   ',
    )
    expect(described[0]).toMatchObject({
      content: [
        { type: 'text', text: '[Image description was empty]' },
        { type: 'file', mediaType: 'application/pdf', data: 'not-an-image' },
      ],
    })
  })
})

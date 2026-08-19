import { describe, expect, it } from 'vitest'
import { deviceElementFromAttributes } from './device-attributes'

describe('deviceElementFromAttributes', () => {
  it('maps valid attributes onto a device element', () => {
    const element = deviceElementFromAttributes({
      mockup: 'tilted-hand',
      screenshot: 'data:image/png;base64,AAA',
      theme: 'coral',
      shadow: '30',
    }, 0)

    expect(element).toMatchObject({
      type: 'device',
      deviceStyle: 'tilted-hand',
      screenshot: 'data:image/png;base64,AAA',
      screenTheme: 'coral',
      shadow: 30,
    })
  })

  it('falls back to safe defaults for unknown values', () => {
    const element = deviceElementFromAttributes({
      mockup: 'pixel-9',
      theme: 'neon',
      shadow: 'lots',
    }, 1)

    expect(element).toMatchObject({
      deviceStyle: 'iphone-17-a',
      screenTheme: 'night',
      shadow: 55,
    })
    expect(element.screenshot).toBeUndefined()
  })

  it('never passes an unresolved or external screenshot through', () => {
    expect(deviceElementFromAttributes({ screenshot: 'asset:upload-missing' }, 0).screenshot).toBeUndefined()
    expect(deviceElementFromAttributes({ screenshot: 'https://evil.example/shot.png' }, 0).screenshot).toBeUndefined()
  })

  it('clamps shadow into the editor range', () => {
    expect(deviceElementFromAttributes({ shadow: '400' }, 0).shadow).toBe(100)
    expect(deviceElementFromAttributes({ shadow: '-4' }, 0).shadow).toBe(0)
  })
})

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

  it('maps new ipad and android styles onto a device element', () => {
    const ipad = deviceElementFromAttributes({ mockup: 'ipad-pro-portrait' }, 0)
    expect(ipad.deviceStyle).toBe('ipad-pro-portrait')

    const android = deviceElementFromAttributes({ mockup: 'android-phone' }, 1)
    expect(android.deviceStyle).toBe('android-phone')
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

  it('accepts an object URL resolved from the Blob asset store', () => {
    const screenshot = 'blob:http://127.0.0.1:4173/0b1c2d3e'
    expect(deviceElementFromAttributes({ screenshot }, 0).screenshot).toBe(screenshot)
  })

  it('clamps shadow into the editor range', () => {
    expect(deviceElementFromAttributes({ shadow: '400' }, 0).shadow).toBe(100)
    expect(deviceElementFromAttributes({ shadow: '-4' }, 0).shadow).toBe(0)
  })
})

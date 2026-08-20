import { describe, expect, it } from 'vitest'
import { deriveSharePreviewPalette } from './share-preview-palette'

type Rgb = readonly [number, number, number]

const makePixels = (width: number, height: number, color: Rgb, alpha = 255) => {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    pixels[offset] = color[0]
    pixels[offset + 1] = color[1]
    pixels[offset + 2] = color[2]
    pixels[offset + 3] = alpha
  }
  return pixels
}

const setPixel = (pixels: Uint8ClampedArray, width: number, x: number, y: number, color: Rgb) => {
  const offset = (y * width + x) * 4
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
  pixels[offset + 3] = 255
}

describe('deriveSharePreviewPalette', () => {
  it('uses the dominant and contrasting colors from the rendered screen edges', () => {
    const width = 10
    const height = 10
    const pixels = makePixels(width, height, [244, 236, 215])
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < width; x += 1) setPixel(pixels, width, x, y, [242, 165, 55])
    }

    expect(deriveSharePreviewPalette(pixels, width, height)).toEqual({
      color1: '#f4ecd7',
      color2: '#f2a537',
    })
  })

  it('ignores focal content in the center and insignificant edge noise', () => {
    const width = 12
    const height = 12
    const pixels = makePixels(width, height, [223, 232, 218])
    for (let y = 4; y < 8; y += 1) {
      for (let x = 4; x < 8; x += 1) setPixel(pixels, width, x, y, [12, 13, 18])
    }
    setPixel(pixels, width, 0, 0, [255, 0, 255])

    expect(deriveSharePreviewPalette(pixels, width, height)).toEqual({
      color1: '#dfe8da',
      color2: '#dfe8da',
    })
  })

  it('returns no palette when dimensions or visible pixels are unavailable', () => {
    expect(deriveSharePreviewPalette(new Uint8ClampedArray(), 0, 0)).toBeNull()
    expect(deriveSharePreviewPalette(new Uint8ClampedArray(3), 1, 1)).toBeNull()
    expect(deriveSharePreviewPalette(makePixels(2, 2, [255, 255, 255], 0), 2, 2)).toBeNull()
  })
})

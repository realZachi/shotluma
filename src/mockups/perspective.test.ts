import { describe, expect, it } from 'vitest'
import { createPerspectiveMapping } from './perspective'
import type { PhotoMockupDefinition } from './catalog'

const definition: PhotoMockupDefinition = {
  overlay: 'mockup.webp',
  canvasAspectRatio: 0.5,
  sourceAspectRatio: 0.5,
  defaultPlacement: { x: 0, y: 0, width: 100, rotation: 0 },
  screenQuad: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
}

describe('createPerspectiveMapping', () => {
  it('uses the rendered mockup width for real screenshots', () => {
    const mapping = createPerspectiveMapping({
      width: 900,
      height: 1800,
      definition,
      hasScreenshot: true,
    })

    expect(mapping.sourceWidth).toBe(900)
    expect(mapping.sourceHeight).toBe(1800)
    expect(mapping.transform).toBe('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)')
  })

  it('keeps small screens oversampled', () => {
    const mapping = createPerspectiveMapping({
      width: 80,
      height: 160,
      definition,
      hasScreenshot: true,
    })

    expect(mapping.sourceWidth).toBe(139.2)
    expect(mapping.sourceHeight).toBe(278.4)
  })

  it('keeps the fixed coordinate plane for generated placeholders', () => {
    const mapping = createPerspectiveMapping({
      width: 900,
      height: 1800,
      definition,
      hasScreenshot: false,
    })

    expect(mapping.sourceWidth).toBe(139.2)
    expect(mapping.sourceHeight).toBe(278.4)
  })
})

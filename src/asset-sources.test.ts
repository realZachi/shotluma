import { describe, expect, it } from 'vitest'
import { collectAssetSources, mapAssetSources } from './asset-sources'
import type { Slide, UploadAsset } from './types'

const makeSlide = (overrides: Partial<Slide> = {}): Slide => ({
  id: 'slide-1',
  name: 'Screen 1',
  background: { type: 'solid', color1: '#000', color2: '#000', angle: 0 },
  elements: [],
  ...overrides,
})

const makeUpload = (src: string): UploadAsset => ({ id: 'upload-1', name: 'shot.png', src })

const projectFixture = () => ({
  uploads: [makeUpload('data:image/png;base64,AAA')],
  slides: [
    makeSlide({
      background: { type: 'image', color1: '#000', color2: '#000', angle: 0, image: 'data:image/png;base64,BBB' },
      elements: [
        {
          id: 'image-1', type: 'image' as const, x: 0, y: 0, width: 10, rotation: 0, opacity: 1,
          src: 'data:image/png;base64,AAA', borderRadius: 0,
        },
        {
          id: 'device-1', type: 'device' as const, x: 0, y: 0, width: 10, rotation: 0, opacity: 1,
          deviceStyle: 'iphone-17-a' as const, screenTheme: 'coral' as const, tiltX: 0, tiltY: 0, shadow: 0,
          screenshot: 'data:image/png;base64,CCC',
        },
        {
          id: 'shape-1', type: 'shape' as const, x: 0, y: 0, width: 10, rotation: 0, opacity: 1,
          shape: 'circle' as const, color: '#fff', strokeColor: '#000', strokeWidth: 0, shadow: 0,
        },
      ],
    }),
  ],
})

describe('collectAssetSources', () => {
  it('collects uploads, background images, image elements, and device screenshots once each', () => {
    expect(collectAssetSources(projectFixture())).toEqual(new Set([
      'data:image/png;base64,AAA',
      'data:image/png;base64,BBB',
      'data:image/png;base64,CCC',
    ]))
  })

  it('skips absent optional sources and empty projects', () => {
    expect(collectAssetSources({ uploads: [], slides: [makeSlide()] })).toEqual(new Set())
    expect(collectAssetSources({ uploads: [], slides: [] })).toEqual(new Set())
  })
})

describe('mapAssetSources', () => {
  it('rewrites every source field through the mapper', () => {
    const mapped = mapAssetSources(projectFixture(), (src) => `mapped:${src.slice(-3)}`)
    expect(mapped.uploads[0]?.src).toBe('mapped:AAA')
    expect(mapped.slides[0]?.background.image).toBe('mapped:BBB')
    expect(mapped.slides[0]?.elements[0]).toMatchObject({ src: 'mapped:AAA' })
    expect(mapped.slides[0]?.elements[1]).toMatchObject({ screenshot: 'mapped:CCC' })
  })

  it('preserves untouched objects by identity so undo history keeps sharing structure', () => {
    const project = projectFixture()
    const identical = mapAssetSources(project, (src) => src)
    expect(identical.slides[0]).toBe(project.slides[0])
    expect(identical.uploads[0]).toBe(project.uploads[0])

    const partial = mapAssetSources(project, (src) => src.endsWith('AAA') ? 'mapped:AAA' : src)
    expect(partial.slides[0]).not.toBe(project.slides[0])
    expect(partial.slides[0]?.background).toBe(project.slides[0]?.background)
    expect(partial.slides[0]?.elements[1]).toBe(project.slides[0]?.elements[1])
    expect(partial.slides[0]?.elements[2]).toBe(project.slides[0]?.elements[2])
  })
})

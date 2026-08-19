import { describe, expect, it } from 'vitest'
import { collectAssetReferences, resolveAssetReferences } from './assets'

const resolver = (map: Record<string, string>) => (assetId: string) => map[assetId]

describe('resolveAssetReferences', () => {
  it('resolves references in img src, CSS url(), and device attributes', () => {
    const html = [
      '<img src="asset:upload-abc1234">',
      '<div style="background-image:url(asset:upload-abc1234)"></div>',
      '<shotluma-device screenshot="asset:upload-xyz9876"></shotluma-device>',
    ].join('')

    const resolved = resolveAssetReferences(html, resolver({
      'upload-abc1234': 'data:image/png;base64,AAA',
      'upload-xyz9876': 'data:image/png;base64,BBB',
    }))

    expect(resolved).toBe([
      '<img src="data:image/png;base64,AAA">',
      '<div style="background-image:url(data:image/png;base64,AAA)"></div>',
      '<shotluma-device screenshot="data:image/png;base64,BBB"></shotluma-device>',
    ].join(''))
  })

  it('leaves unknown references untouched', () => {
    const html = '<img src="asset:upload-missing">'
    expect(resolveAssetReferences(html, resolver({}))).toBe(html)
  })
})

describe('collectAssetReferences', () => {
  it('lists each referenced id once', () => {
    const html = '<img src="asset:upload-a"><img src="asset:upload-a"><img src="asset:upload-b">'
    expect(collectAssetReferences(html)).toEqual(['upload-a', 'upload-b'])
  })

  it('returns nothing for markup without references', () => {
    expect(collectAssetReferences('<div>plain</div>')).toEqual([])
  })
})

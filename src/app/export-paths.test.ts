import { describe, expect, it } from 'vitest'
import {
  getExportZipDownloadName,
  getExportZipEntryPath,
  getSafeFilename,
  getSlidePngFilename,
} from './export-paths'

describe('getSafeFilename', () => {
  it('sanitizes unsafe characters', () => {
    expect(getSafeFilename('My Project! / v2', 'Shotluma')).toBe('My-Project-v2')
  })

  it('falls back when the name is empty after sanitizing', () => {
    expect(getSafeFilename('!!!', 'Shotluma')).toBe('Shotluma')
  })
})

describe('getSlidePngFilename', () => {
  it('prefixes a zero-padded slide index', () => {
    expect(getSlidePngFilename(0, 'Hero')).toBe('01-Hero.png')
    expect(getSlidePngFilename(9, 'Feature One')).toBe('10-Feature-One.png')
  })
})

describe('getExportZipEntryPath', () => {
  it('keeps a flat path for a single format export', () => {
    expect(getExportZipEntryPath('6.9-inch-iPhone', 0, 'Hero', false)).toBe('01-Hero.png')
  })

  it('nests files under the format folder for all-sizes export', () => {
    expect(getExportZipEntryPath('6.5-inch-iPhone', 1, 'Details', true))
      .toBe('6.5-inch-iPhone/02-Details.png')
    expect(getExportZipEntryPath('13-inch-iPad', 0, 'Hero', true))
      .toBe('13-inch-iPad/01-Hero.png')
    expect(getExportZipEntryPath('Android-Phone', 2, 'Features', true))
      .toBe('Android-Phone/03-Features.png')
  })

  it('prefixes locale directory when non-default locale is provided', () => {
    expect(getExportZipEntryPath('6.9-inch-iPhone', 0, 'Hero', false, 'es-ES'))
      .toBe('es-ES/01-Hero.png')
    expect(getExportZipEntryPath('6.9-inch-iPhone', 1, 'Details', true, 'ja-JP'))
      .toBe('ja-JP/6.9-inch-iPhone/02-Details.png')
  })
})

describe('getExportZipDownloadName', () => {
  it('builds a download name from the project and format', () => {
    expect(getExportZipDownloadName('Launch Kit', '6.9-inch-iPhone'))
      .toBe('Launch-Kit-6.9-inch-iPhone-Screens.zip')
    expect(getExportZipDownloadName('App Pro', '13-inch-iPad'))
      .toBe('App-Pro-13-inch-iPad-Screens.zip')
    expect(getExportZipDownloadName('  ', 'all-sizes'))
      .toBe('Shotluma-all-sizes-Screens.zip')
  })
})

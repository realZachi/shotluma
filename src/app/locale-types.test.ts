import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleDefinition,
} from './locale-types'

describe('locale-types', () => {
  it('defines default locale as en-US', () => {
    expect(DEFAULT_LOCALE).toBe('en-US')
  })

  it('includes key app store languages', () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code)
    expect(codes).toContain('en-US')
    expect(codes).toContain('es-ES')
    expect(codes).toContain('ja-JP')
    expect(codes).toContain('de-DE')
    expect(codes).toContain('fr-FR')
  })

  it('retrieves definition for known locale', () => {
    const def = getLocaleDefinition('ja-JP')
    expect(def.label).toBe('Japanese')
    expect(def.nativeLabel).toBe('日本語')
    expect(def.flag).toBe('🇯🇵')
  })

  it('falls back gracefully for unknown locale code', () => {
    const def = getLocaleDefinition('custom-locale')
    expect(def.code).toBe('custom-locale')
    expect(def.label).toBe('custom-locale')
  })
})

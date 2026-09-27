import { describe, expect, it } from 'vitest'
import { makeTemplate, templateMeta } from './data'

describe('data templates', () => {
  it('defines valid metadata for all templates', () => {
    expect(templateMeta.length).toBeGreaterThanOrEqual(8)
    const ids = templateMeta.map((t) => t.id)
    expect(ids).toContain('split-tablet')
    expect(ids).toContain('panoramic-duo')
  })

  it.each(templateMeta.map((t) => t.id))('generates valid slide structure for %s', (templateId) => {
    const slide = makeTemplate(templateId, 'Test Screen')
    expect(slide.id).toBeDefined()
    expect(slide.name).toBe('Test Screen')
    expect(slide.background).toBeDefined()
    expect(slide.elements.length).toBeGreaterThan(0)
  })

  it('correctly configures split-tablet template with landscape iPad', () => {
    const slide = makeTemplate('split-tablet')
    const deviceEl = slide.elements.find((el) => el.type === 'device')
    expect(deviceEl).toBeDefined()
    if (deviceEl?.type === 'device') {
      expect(deviceEl.deviceStyle).toBe('ipad-pro-landscape')
      expect(deviceEl.cleanStatusBar).toBe(true)
    }
  })

  it('correctly configures panoramic-duo template with spanning device', () => {
    const slide = makeTemplate('panoramic-duo')
    const deviceEl = slide.elements.find((el) => el.type === 'device')
    expect(deviceEl).toBeDefined()
    if (deviceEl?.type === 'device') {
      expect(deviceEl.spansScreens).toBe(true)
      expect(deviceEl.cleanStatusBar).toBe(true)
    }
  })
})

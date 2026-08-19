import { describe, expect, it } from 'vitest'
import { buildHtmlInstructions } from './html-prompt'

describe('buildHtmlInstructions', () => {
  it('teaches the generate toolset and the device component', () => {
    const instructions = buildHtmlInstructions()

    expect(instructions).toContain('add_html_screen')
    expect(instructions).toContain('declare_plan')
    expect(instructions).toContain('<shotluma-device')
    expect(instructions).toContain('1290 px wide by 2796 px tall')
    expect(instructions).toContain('render_slide_preview')
  })

  it('states the sanitizer constraints the runtime enforces', () => {
    const instructions = buildHtmlInstructions()

    expect(instructions).toContain('EXTERNAL URLS OF ANY KIND')
    expect(instructions).toContain('asset:')
    expect(instructions).toContain('data:image/')
    expect(instructions).toContain('@font-face')
  })

  it('scopes edit runs to the target screen without creation tools', () => {
    const instructions = buildHtmlInstructions({ targetSlideId: 'slide-7' })

    expect(instructions).toContain('slide-7')
    expect(instructions).toContain('not available in this edit run')
    expect(instructions).not.toContain('declare_plan once the plan is fixed')
  })

  it('shares the bundled font library with the element prompt', () => {
    expect(buildHtmlInstructions()).toContain('Bricolage Grotesque Variable')
  })
})

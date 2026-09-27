import { describe, expect, it } from 'vitest'
import { makeTemplate } from '../data'
import { convertHtmlSlideToElements } from './convert-to-elements'
import type { UploadAsset } from '../types'

describe('convertHtmlSlideToElements', () => {
  const baseSlide = makeTemplate('ink', 'Test Screen')

  it('converts an HTML slide with shotluma-device and headings into canvas elements', () => {
    const html = `
      <div style="background:#18181c; color:#ffffff;">
        <img class="logo" src="asset:upload-logo" style="left:40%; top:5%; width:20%;" />
        <h1 style="left:10%; top:15%; width:80%;">GRILL. TAP. ENJOY.</h1>
        <p style="left:15%; top:25%; width:70%;">Hot Ghanalan chicken, picked your way.</p>
        <shotluma-device mockup="iphone-17-b" screenshot="asset:upload-shot" theme="night" shadow="60" style="left:15%; top:40%; width:70%; transform:rotate(5deg);"></shotluma-device>
      </div>
    `
    const uploads: UploadAsset[] = [
      { id: 'upload-logo', name: 'app-logo.png', src: 'blob:http://localhost/logo.png' },
      { id: 'upload-shot', name: 'app-shot.png', src: 'blob:http://localhost/shot.png' },
    ]

    const slide = {
      ...baseSlide,
      html,
    }

    const { elements, background } = convertHtmlSlideToElements(slide, uploads)

    expect(background.color1).toBe('#18181c')
    expect(elements.length).toBe(4) // 1 image/logo, 2 text elements (h1, p), 1 device

    const logoElem = elements.find((e) => e.type === 'image')
    expect(logoElem).toBeDefined()
    expect(logoElem?.src).toBe('blob:http://localhost/logo.png')

    const headingElem = elements.find((e) => e.type === 'text' && e.text.includes('GRILL'))
    expect(headingElem).toBeDefined()
    expect(headingElem?.fontSize).toBe(44)
    expect(headingElem?.fontWeight).toBe(700)

    const deviceElem = elements.find((e) => e.type === 'device')
    expect(deviceElem).toBeDefined()
    expect(deviceElem?.deviceStyle).toBe('iphone-17-b')
    expect(deviceElem?.screenshot).toBe('blob:http://localhost/shot.png')
    expect(deviceElem?.rotation).toBe(5)
  })

  it('returns original elements if slide has no html', () => {
    const result = convertHtmlSlideToElements(baseSlide, [])
    expect(result.elements).toEqual(baseSlide.elements)
  })
})

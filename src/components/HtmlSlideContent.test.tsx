import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HtmlSlideContent } from './HtmlSlideContent'

describe('HtmlSlideContent', () => {
  it('renders sanitized slide html', () => {
    const html = '<div class="hero"><h1>Test Headline</h1></div>'
    const rendered = renderToStaticMarkup(
      <HtmlSlideContent html={html} uploads={[]} />,
    )
    expect(rendered).toContain('html-slide-surface')
    expect(rendered).toContain('html-slide-scale')
  })

  it('renders with interactive class when interactive is true', () => {
    const html = '<h1>Interactive Title</h1>'
    const onUpdate = vi.fn()
    const rendered = renderToStaticMarkup(
      <HtmlSlideContent
        html={html}
        uploads={[]}
        interactive={true}
        onUpdateHtml={onUpdate}
      />,
    )
    expect(rendered).toContain('is-interactive')
  })
})

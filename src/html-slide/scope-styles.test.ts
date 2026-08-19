import { describe, expect, it } from 'vitest'
import { rewriteRootSelectors, scopeSlideStyles } from './scope-styles'

const containerWith = (html: string): HTMLElement => {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

describe('scopeSlideStyles', () => {
  it('wraps every style block in a prelude-less @scope with the device donut hole', () => {
    const container = containerWith('<style>.hero { color: red; }</style><div class="hero">hi</div>')

    scopeSlideStyles(container)

    const css = container.querySelector('style')?.textContent ?? ''
    expect(css.trimStart().startsWith('@scope to (shotluma-device > *) {')).toBe(true)
    expect(css).toContain('.hero { color: red; }')
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  it('scopes multiple style blocks independently', () => {
    const container = containerWith('<style>.a { color: red; }</style><style>.b { color: blue; }</style>')

    scopeSlideStyles(container)

    const blocks = Array.from(container.querySelectorAll('style'))
    expect(blocks).toHaveLength(2)
    for (const block of blocks) {
      expect(block.textContent).toContain('@scope to (shotluma-device > *)')
    }
  })

  it('leaves markup a model already scoped alone', () => {
    const original = '@scope { .hero { color: red; } }'
    const container = containerWith(`<style>${original}</style>`)

    scopeSlideStyles(container)

    expect(container.querySelector('style')?.textContent).toBe(original)
  })
})

describe('rewriteRootSelectors', () => {
  it('retargets body, html, and :root at the scope root', () => {
    expect(rewriteRootSelectors('body { background: red; }')).toBe(':scope { background: red; }')
    expect(rewriteRootSelectors('html, body { margin: 0; }')).toBe(':scope, :scope { margin: 0; }')
    expect(rewriteRootSelectors(':root { --accent: lime; }')).toBe(':scope { --accent: lime; }')
  })

  it('does not touch class names or nested words that merely contain the keywords', () => {
    expect(rewriteRootSelectors('.body-copy { color: red; }')).toBe('.body-copy { color: red; }')
    expect(rewriteRootSelectors('.html-badge { color: red; }')).toBe('.html-badge { color: red; }')
  })

  it('collapses chained root selectors into a single :scope', () => {
    expect(rewriteRootSelectors('html body { margin: 0; }')).toBe(':scope { margin: 0; }')
    expect(rewriteRootSelectors('html > body { margin: 0; }')).toBe(':scope { margin: 0; }')
    expect(rewriteRootSelectors(':root body .screen { color: red; }')).toBe(':scope .screen { color: red; }')
  })

  it('treats CSS comments as selector separators', () => {
    expect(rewriteRootSelectors('html /* root */ body { margin: 0; }')).toBe(':scope { margin: 0; }')
    expect(rewriteRootSelectors('html/**/body { margin: 0; }')).toBe(':scope { margin: 0; }')
  })
})

import { describe, expect, it } from 'vitest'
import { sanitizeScreenHtml } from './sanitize'

describe('screen html sanitization', () => {
  it('returns nothing for empty input', () => {
    expect(sanitizeScreenHtml('')).toEqual({ html: '', violations: [] })
  })

  it('keeps plain text untouched', () => {
    const result = sanitizeScreenHtml('Launch faster')
    expect(result.html).toBe('Launch faster')
    expect(result.violations).toEqual([])
  })

  it('removes scripts and iframes with their subtrees', () => {
    const result = sanitizeScreenHtml('<div>keep<script>fetch("https://evil.test")</script><iframe src="https://evil.test"><p>gone</p></iframe></div>')
    expect(result.html).toBe('<div>keep</div>')
    expect(result.violations).toEqual([
      'Removed disallowed element <script>.',
      'Removed disallowed element <iframe>.',
    ])
  })

  it('removes event handler attributes', () => {
    const result = sanitizeScreenHtml('<div ONCLICK="steal()" onmouseenter="steal()">hi</div>')
    expect(result.html).toBe('<div>hi</div>')
    expect(result.violations).toEqual([
      'Removed event handler attribute "onclick" on <div>.',
      'Removed event handler attribute "onmouseenter" on <div>.',
    ])
  })

  it('removes anchors carrying javascript urls', () => {
    const result = sanitizeScreenHtml('<a href="javascript:steal()">tap</a>')
    expect(result.html).toBe('')
    expect(result.violations).toEqual(['Removed disallowed element <a>.'])
  })

  it('keeps internal image sources and drops external ones', () => {
    const result = sanitizeScreenHtml([
      '<img src="asset:abc123" alt="shot">',
      '<img src="data:image/png;base64,x">',
      '<img src="https://evil.test/pixel.png">',
      '<img src="//evil.test/pixel.png">',
    ].join(''))
    expect(result.html).toContain('src="asset:abc123"')
    expect(result.html).toContain('src="data:image/png;base64,x"')
    expect(result.html).not.toContain('evil.test')
    expect(result.violations).toEqual([
      'Removed external URL in "src" on <img>.',
      'Removed <img> without a usable src.',
      'Removed external URL in "src" on <img>.',
      'Removed <img> without a usable src.',
    ])
  })

  it('strips non-fragment url() references from svg presentation attributes', () => {
    const result = sanitizeScreenHtml([
      '<svg viewBox="0 0 10 10">',
      '<rect fill="url(#grad)" filter="url(https://evil.test/f.svg#f)"></rect>',
      '<circle mask="url(&quot;https://evil.test/m.svg#m&quot;)" clip-path="url(#clip)"></circle>',
      '</svg>',
    ].join(''))

    expect(result.html).toContain('fill="url(#grad)"')
    expect(result.html).toContain('clip-path="url(#clip)"')
    expect(result.html).not.toContain('evil.test')
    expect(result.violations).toEqual([
      'Removed non-fragment url() in "filter" on <rect>.',
      'Removed non-fragment url() in "mask" on <circle>.',
    ])
  })

  it('removes an img left without a src entirely so rasterization cannot fail on it', () => {
    const result = sanitizeScreenHtml('<div><img src="https://evil.test/x.png"><img></div>')
    expect(result.html).toBe('<div></div>')
    expect(result.violations).toContain('Removed <img> without a usable src.')
  })

  it('drops attributes outside the html allowlist', () => {
    const result = sanitizeScreenHtml('<div data-track="x" srcset="https://evil.test/a.png" class="hero" id="main">hi</div>')
    expect(result.html).toBe('<div class="hero" id="main">hi</div>')
    expect(result.violations).toEqual([
      'Removed disallowed attribute "data-track" on <div>.',
      'Removed disallowed attribute "srcset" on <div>.',
    ])
  })

  it('neutralizes external urls in style attributes', () => {
    const result = sanitizeScreenHtml('<div style="background-image: URL( &quot;HTTPS://evil.test/a.png&quot; ); color: red">hi</div>')
    expect(result.html).toContain('none')
    expect(result.html).toContain('color: red')
    expect(result.html).not.toContain('evil.test')
    expect(result.violations).toEqual(['Replaced external url() in the style attribute of <div> with none.'])
  })

  it('keeps inline data image urls in style attributes', () => {
    const markup = '<div style="background-image: url(\'data:image/svg+xml,%3Csvg%3E\')">hi</div>'
    const result = sanitizeScreenHtml(markup)
    expect(result.html).toContain('data:image/svg+xml')
    expect(result.violations).toEqual([])
  })

  it('cleans style elements', () => {
    const result = sanitizeScreenHtml([
      '<style>',
      '@import url("https://fonts.test/font.css");',
      '.hero { background: url( "https://evil.test/a.png" ); }',
      '.badge { background: url(asset:logo-1); }',
      '</style>',
      '<div class="hero"></div>',
    ].join('\n'))
    expect(result.html).not.toContain('@import')
    expect(result.html).not.toContain('evil.test')
    expect(result.html).toContain('background: none')
    expect(result.html).toContain('url(asset:logo-1)')
    expect(result.violations).toEqual([
      'Removed @import rule in a <style> element.',
      'Replaced external url() in a <style> element with none.',
    ])
  })

  it('keeps the device element and its attributes', () => {
    const result = sanitizeScreenHtml('<shotluma-device mockup="iphone-16" screenshot="asset:shot-1" theme="dark" shadow="soft" onload="steal()" data-x="1"></shotluma-device>')
    expect(result.html).toBe('<shotluma-device mockup="iphone-16" screenshot="asset:shot-1" theme="dark" shadow="soft"></shotluma-device>')
    expect(result.violations).toEqual([
      'Removed event handler attribute "onload" on <shotluma-device>.',
      'Removed disallowed attribute "data-x" on <shotluma-device>.',
    ])
  })

  it('keeps svg drawing markup including camelCase attributes', () => {
    const result = sanitizeScreenHtml('<svg viewBox="0 0 10 10"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"></stop></linearGradient></defs><path d="M0 0H10" fill="url(#g)"></path></svg>')
    expect(result.html).toContain('viewBox="0 0 10 10"')
    expect(result.html).toContain('gradientUnits="userSpaceOnUse"')
    expect(result.html).toContain('<path d="M0 0H10"')
    expect(result.violations).toEqual([])
  })

  it('removes svg escape hatches', () => {
    const result = sanitizeScreenHtml('<svg><foreignObject><div>gone</div></foreignObject><circle r="4"><animate attributeName="r" values="1;9"></animate></circle></svg>')
    expect(result.html).not.toContain('foreignObject')
    expect(result.html).not.toContain('animate')
    expect(result.html).toContain('<circle r="4">')
    expect(result.violations).toEqual([
      'Removed disallowed element <foreignobject>.',
      'Removed disallowed element <animate>.',
    ])
  })

  it('allows same-document use references and drops external ones', () => {
    const result = sanitizeScreenHtml('<svg><use href="#glyph"></use><use href="https://evil.test/sprite.svg#glyph"></use><use xlink:href="https://evil.test/sprite.svg"></use></svg>')
    expect(result.html).toContain('href="#glyph"')
    expect(result.html).not.toContain('evil.test')
    expect(result.violations).toEqual([
      'Removed external URL in "href" on <use>.',
      'Removed external URL in "xlink:href" on <use>.',
    ])
  })

  it('removes unknown elements but keeps their allowed ancestors', () => {
    const result = sanitizeScreenHtml('<section><marquee>spin</marquee><p>stay</p></section>')
    expect(result.html).toBe('<section><p>stay</p></section>')
    expect(result.violations).toEqual(['Removed disallowed element <marquee>.'])
  })

  it('removes comments silently', () => {
    const result = sanitizeScreenHtml('<div><!-- note -->hi</div>')
    expect(result.html).toBe('<div>hi</div>')
    expect(result.violations).toEqual([])
  })

  it('is idempotent', () => {
    const markup = [
      '<style>@import "https://fonts.test/f.css"; .hero { background: url(https://evil.test/a.png); }</style>',
      '<section class="hero" onclick="steal()">',
      '<script>steal()</script>',
      '<h1 style="background: url(&quot;https://evil.test/b.png&quot;)">Title</h1>',
      '<img src="https://evil.test/c.png" alt="x">',
      '<shotluma-device mockup="iphone-16" screenshot="asset:shot-1"></shotluma-device>',
      '<svg viewBox="0 0 4 4"><use href="#glyph"></use></svg>',
      '</section>',
    ].join('')

    const first = sanitizeScreenHtml(markup)
    expect(first.violations.length).toBeGreaterThan(0)

    const second = sanitizeScreenHtml(first.html)
    expect(second.html).toBe(first.html)
    expect(second.violations).toEqual([])
  })
})

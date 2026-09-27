import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CleanStatusBarOverlay } from './CleanStatusBarOverlay'

describe('CleanStatusBarOverlay', () => {
  it('renders default 9:41 time for iOS and icons', () => {
    const html = renderToStaticMarkup(<CleanStatusBarOverlay sourceWidth={1000} />)

    expect(html).toContain('clean-status-bar')
    expect(html).toContain('9:41')
    expect(html).toContain('clean-status-bar--light')
  })

  it('renders 10:00 default for Android', () => {
    const html = renderToStaticMarkup(<CleanStatusBarOverlay sourceWidth={1000} isAndroid={true} />)

    expect(html).toContain('10:00')
  })

  it('renders custom time override', () => {
    const html = renderToStaticMarkup(<CleanStatusBarOverlay sourceWidth={1000} time="8:30 PM" />)

    expect(html).toContain('8:30 PM')
  })

  it('renders dark theme with appropriate styling', () => {
    const html = renderToStaticMarkup(<CleanStatusBarOverlay sourceWidth={1000} theme="dark" />)

    expect(html).toContain('clean-status-bar--dark')
    expect(html).toContain('#ffffff')
  })

  it('renders dynamic island when enabled', () => {
    const html = renderToStaticMarkup(<CleanStatusBarOverlay sourceWidth={1000} showDynamicIsland={true} />)

    expect(html).toContain('clean-status-island')
  })
})

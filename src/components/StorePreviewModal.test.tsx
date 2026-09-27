import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getScreenFormat } from '../app/export-formats'
import { makeTemplate } from '../data'
import { StorePreviewModal } from './StorePreviewModal'

describe('StorePreviewModal', () => {
  const slide1 = makeTemplate('ink', 'Screen 1')
  const slide2 = makeTemplate('paper', 'Screen 2')

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(
      <StorePreviewModal
        open={false}
        onClose={() => undefined}
        slides={[slide1, slide2]}
        uploads={[]}
        projectName="Test App"
        screenFormat={getScreenFormat()}
      />,
    )
    expect(html).toBe('')
  })

  it('renders search card view with app title, metrics and slides when open', () => {
    const html = renderToStaticMarkup(
      <StorePreviewModal
        open={true}
        onClose={() => undefined}
        slides={[slide1, slide2]}
        uploads={[]}
        projectName="Super App"
        screenFormat={getScreenFormat()}
      />,
    )
    expect(html).toContain('Storefront Simulator')
    expect(html).toContain('Super App')
    expect(html).toContain('store-sim-gallery')
    expect(html).toContain(`store-thumb-${slide1.id}`)
    expect(html).toContain(`store-thumb-${slide2.id}`)
  })

  it('renders correctly with Android screen format and empty slides', () => {
    const androidFormat = getScreenFormat('android-phone')
    const html = renderToStaticMarkup(
      <StorePreviewModal
        open={true}
        onClose={() => undefined}
        slides={[]}
        uploads={[]}
        projectName="Android Utility"
        screenFormat={androidFormat}
      />,
    )
    expect(html).toContain('Storefront Simulator')
    expect(html).toContain('store-device-frame--android')
    expect(html).toContain('No screens in project yet')
  })

  it('renders correctly with HTML slides without throwing or layout corruption', () => {
    const htmlSlide = {
      ...slide1,
      html: '<div class="banner"><h1>Chiq n Grill</h1></div>',
    }
    const html = renderToStaticMarkup(
      <StorePreviewModal
        open={true}
        onClose={() => undefined}
        slides={[htmlSlide]}
        uploads={[]}
        projectName="Chiq n Grill"
        screenFormat={getScreenFormat()}
      />,
    )
    expect(html).toContain('Storefront Simulator')
    expect(html).toContain('store-slide-thumb')
    expect(html).toContain(`store-thumb-${htmlSlide.id}`)
  })
})

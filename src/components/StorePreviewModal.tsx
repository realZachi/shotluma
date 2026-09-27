import { useMemo, useRef, useState } from 'react'
import { getScreenFormat, type ExportFormat } from '../app/export-formats'
import { getBackgroundPatternStyle, getBackgroundStyle } from '../utils'
import { ElementContent } from './CanvasElementView'
import { HtmlSlideContent } from './HtmlSlideContent'
import { Search01, X } from './icons'
import { Button } from './ui/button'
import type { Slide, UploadAsset } from '../types'

type StorePreviewModalProps = {
  open: boolean
  onClose: () => void
  slides: Slide[]
  uploads: UploadAsset[]
  projectName: string
  screenFormat?: ExportFormat | undefined
}

type Platform = 'ios' | 'android'
type ViewMode = 'search' | 'product'

const isTabletFormat = (format: ExportFormat) =>
  format.category === 'ipad' || format.id.includes('tablet')

const StoreSlideThumbnail = ({
  slide,
  width,
  format,
  uploads,
}: {
  slide: Slide
  width: number
  format: ExportFormat
  uploads: UploadAsset[]
}) => {
  const height = Math.round((width * format.height) / format.width)
  const scale = width / format.editorWidth
  const backgroundStyle = {
    ...getBackgroundStyle(slide.background),
    ...getBackgroundPatternStyle(slide.background),
  }
  const pattern = slide.background.pattern ?? 'none'

  return (
    <div
      className="store-slide-thumb"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: isTabletFormat(format) ? '8px' : '12px',
        boxShadow: '0 3px 10px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        flexShrink: 0,
        backgroundColor: slide.background.color1,
      }}
      data-testid={`store-thumb-${slide.id}`}
    >
      <div
        style={{
          width: `${format.editorWidth}px`,
          height: `${Math.round((format.editorWidth * format.height) / format.width)}px`,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'none',
          '--canvas-width': `${format.width}px`,
          '--canvas-height': `${format.height}px`,
          '--artboard-width': `${format.editorWidth}px`,
          '--artboard-height': `${Math.round((format.editorWidth * format.height) / format.width)}px`,
        } as React.CSSProperties}
      >
        {slide.html !== undefined
          ? <HtmlSlideContent html={slide.html} uploads={uploads} />
          : (
              <>
                <div
                  className={`artboard-background pattern-surface pattern--${pattern}`}
                  style={backgroundStyle}
                />
                {slide.elements.map((element) => (
                  <div
                    key={element.id}
                    style={{
                      position: 'absolute',
                      left: `${element.x}%`,
                      top: `${element.y}%`,
                      width: `${element.width}%`,
                      opacity: element.opacity,
                      transform: `rotate(${element.rotation}deg)`,
                    }}
                  >
                    <ElementContent element={element} />
                  </div>
                ))}
              </>
            )}
      </div>
    </div>
  )
}

const IMG_SRC_REGEX = /<img[^>]+src=["'](blob:[^"']+|data:image\/[^"']+|asset:[^"']+)["']/i

function extractHtmlImageSrc(html: string, uploads: UploadAsset[]): string | undefined {
  const match = IMG_SRC_REGEX.exec(html)
  if (!match?.[1]) return undefined
  const raw = match[1]
  if (!raw.startsWith('asset:')) return raw
  const assetId = raw.replace('asset:', '')
  return uploads.find((u) => u.id === assetId)?.src
}

function detectAppLogo(slides: Slide[], uploads: UploadAsset[]): string | undefined {
  const explicitLogo = uploads.find((u) => u.name.toLowerCase().includes('logo'))
  if (explicitLogo?.src) return explicitLogo.src

  for (const slide of slides) {
    if (slide.html) {
      const src = extractHtmlImageSrc(slide.html, uploads)
      if (src) return src
    }
    const imgElem = slide.elements.find((e) => e.type === 'image' && e.width <= 35)
    if (imgElem && 'src' in imgElem && imgElem.src) return imgElem.src
  }
  return uploads[0]?.src
}

export const StorePreviewModal = ({
  open,
  onClose,
  slides,
  uploads,
  projectName,
  screenFormat = getScreenFormat(),
}: StorePreviewModalProps) => {
  const [platform, setPlatform] = useState<Platform>(
    screenFormat.category === 'android' ? 'android' : 'ios',
  )
  const [viewMode, setViewMode] = useState<ViewMode>('search')
  const [appName, setAppName] = useState(projectName || 'My App')
  const [category] = useState('Productivity')
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const detectedLogo = useMemo(() => detectAppLogo(slides, uploads), [uploads, slides])
  const logoSrc = customLogo ?? detectedLogo

  if (!open) return null

  const isIos = platform === 'ios'
  const isSearch = viewMode === 'search'
  const displayedSlides = isSearch ? slides.slice(0, 3) : slides

  return (
    <div
      className="store-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Storefront simulator"
    >
      <div className="store-modal-card">
        {/* Header Controls */}
        <div className="store-modal-header">
          <div className="store-modal-title">
            <h2>Storefront Simulator</h2>
            <p>Live preview of your screenshot set on app stores.</p>
          </div>

          <div className="store-modal-controls">
            <div className="store-modal-tab-group">
              <button
                type="button"
                className={`store-modal-tab-btn${isIos ? ' is-active' : ''}`}
                onClick={() => setPlatform('ios')}
              >
                App Store
              </button>
              <button
                type="button"
                className={`store-modal-tab-btn${!isIos ? ' is-active' : ''}`}
                onClick={() => setPlatform('android')}
              >
                Google Play
              </button>
            </div>

            <div className="store-modal-tab-group">
              <button
                type="button"
                className={`store-modal-tab-btn${isSearch ? ' is-active' : ''}`}
                onClick={() => setViewMode('search')}
              >
                Search Card
              </button>
              <button
                type="button"
                className={`store-modal-tab-btn${!isSearch ? ' is-active' : ''}`}
                onClick={() => setViewMode('product')}
              >
                Product Page
              </button>
            </div>

            <button
              type="button"
              className="ai-modal-close"
              onClick={onClose}
              aria-label="Close store simulator"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Simulator Body */}
        <div className="store-modal-body">
          <div
            className={`store-device-frame store-device-frame--${platform}`}
          >
            {/* Status bar */}
            <div className="store-sim-status">
              <span>9:41</span>
              <div className="store-sim-status-notch" />
              <span>5G 100%</span>
            </div>

            {/* Search Bar */}
            <div className="store-sim-searchbar">
              <Search01 size={14} />
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Search apps..."
                aria-label="App title"
              />
              <span className="store-sim-avatar">A</span>
            </div>

            {/* Hidden logo input */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  const url = URL.createObjectURL(file)
                  setCustomLogo(url)
                }
              }}
            />

            {/* Search View */}
            {isSearch && (
              <div className="store-sim-search-result">
                <div className="store-sim-app-header">
                  <div
                    className="store-sim-app-icon"
                    onClick={() => logoInputRef.current?.click()}
                    title="App Icon (click to change)"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {logoSrc
                      ? (
                          <img
                            src={logoSrc}
                            alt={appName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                          />
                        )
                      : (
                          <span>{appName.charAt(0).toUpperCase() || 'A'}</span>
                        )}
                  </div>
                  <div className="store-sim-app-info">
                    <strong>{appName}</strong>
                    <small>{category} · Fast & Simple</small>
                    <div className="store-sim-ratings">
                      <span>★★★★★</span>
                      <span>4.9</span>
                      <small>(14.2K)</small>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={
                      isIos ? 'store-sim-get-btn-ios' : 'store-sim-get-btn-play'
                    }
                  >
                    {isIos ? 'GET' : 'Install'}
                  </Button>
                </div>

                <div className="store-sim-gallery">
                  {displayedSlides.length === 0
                    ? (
                        <div className="store-sim-empty-note">
                          No screens in project yet. Add or generate screens to
                          preview!
                        </div>
                      )
                    : (
                        displayedSlides.map((slide) => (
                          <StoreSlideThumbnail
                            key={slide.id}
                            slide={slide}
                            width={isTabletFormat(screenFormat) ? 240 : 155}
                            format={screenFormat}
                            uploads={uploads}
                          />
                        ))
                      )}
                </div>
              </div>
            )}

            {/* Product Page View */}
            {!isSearch && (
              <div className="store-sim-product-page">
                <div className="store-sim-product-hero">
                  <div
                    className="store-sim-app-icon store-sim-app-icon--lg"
                    onClick={() => logoInputRef.current?.click()}
                    title="App Icon (click to change)"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {logoSrc
                      ? (
                          <img
                            src={logoSrc}
                            alt={appName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                          />
                        )
                      : (
                          <span>{appName.charAt(0).toUpperCase() || 'A'}</span>
                        )}
                  </div>
                  <div className="store-sim-product-title">
                    <h3>{appName}</h3>
                    <p>{category} Studio</p>
                    <small>In-App Purchases · Free</small>
                    <Button
                      size="sm"
                      className={
                        isIos
                          ? 'store-sim-get-btn-ios'
                          : 'store-sim-get-btn-play'
                      }
                      style={{ marginTop: '8px' }}
                    >
                      {isIos ? 'GET' : 'Install'}
                    </Button>
                  </div>
                </div>

                {/* Metrics ribbon */}
                <div className="store-sim-metrics">
                  <div>
                    <strong>4.9 ★</strong>
                    <small>14K RATINGS</small>
                  </div>
                  <div className="store-sim-metrics-divider" />
                  <div>
                    <strong>#1</strong>
                    <small>CHART</small>
                  </div>
                  <div className="store-sim-metrics-divider" />
                  <div>
                    <strong>4+</strong>
                    <small>AGE</small>
                  </div>
                </div>

                {/* Screenshots Carousel */}
                <div className="store-sim-product-gallery-section">
                  <h4>Preview</h4>
                  <div className="store-sim-product-carousel">
                    {slides.length === 0
                      ? (
                          <div className="store-sim-empty-note">
                            Add screens to see gallery.
                          </div>
                        )
                      : (
                          slides.map((slide) => (
                            <StoreSlideThumbnail
                              key={slide.id}
                              slide={slide}
                              width={isTabletFormat(screenFormat) ? 260 : 180}
                              format={screenFormat}
                              uploads={uploads}
                            />
                          ))
                        )}
                  </div>
                </div>

                {/* Description */}
                <div className="store-sim-description">
                  <h4>Description</h4>
                  <p>
                    Craft professional, high-converting App Store and Google
                    Play screenshots in seconds with real device mockups,
                    panoramic stitching, and clean status bar indicators.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

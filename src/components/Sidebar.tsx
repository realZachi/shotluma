import { useRef, type ChangeEvent, type ReactNode } from 'react'
import { templateMeta } from '../data'
import { deviceOptions } from '../mockups/catalog'
import { shapeCatalog } from '../shapes'
import { getBackgroundPatternStyle, getBackgroundStyle } from '../utils'
import { IconPicker } from './IconPicker'
import {
  Blend,
  ChevronDown,
  ImagePlus,
  Layers3,
  MonitorSmartphone,
  Palette,
  Plus,
  Shapes,
  Sparkles,
  StartUp02,
  Type,
  Upload,
} from './icons'
import { ShapeGraphic } from './ShapeGraphic'
import type { Background, BackgroundPattern, CanvasElement, ShapeElement, Slide, TemplateId, TextPreset, ToolId, UploadAsset } from '../types'

const tools: { id: ToolId; label: string; icon: ReactNode }[] = [
  { id: 'templates', label: 'Templates', icon: <StartUp02 size={19} /> },
  { id: 'device', label: 'Mockups', icon: <MonitorSmartphone size={19} /> },
  { id: 'elements', label: 'Elements', icon: <Shapes size={19} /> },
  { id: 'icons', label: 'Icons', icon: <Sparkles size={19} /> },
  { id: 'text', label: 'Text', icon: <Type size={19} /> },
  { id: 'background', label: 'Background', icon: <Palette size={19} /> },
  { id: 'uploads', label: 'Uploads', icon: <Upload size={19} /> },
]

export const ToolRail = ({ activeTool, isOpen, onChange }: { activeTool: ToolId; isOpen: boolean; onChange: (tool: ToolId) => void }) => (
  <nav className="tool-rail" aria-label="Editor tools">
    <div className="rail-tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={activeTool === tool.id ? 'is-active' : ''}
          onClick={() => onChange(tool.id)}
          aria-controls="properties-panel"
          aria-expanded={isOpen && activeTool === tool.id}
          aria-label={`${isOpen && activeTool === tool.id ? 'Close' : 'Open'} ${tool.label}`}
          title={tool.label}
        >
          <span>{tool.icon}</span>
          <small>{tool.label}</small>
        </button>
      ))}
    </div>
    <button
      className="rail-layers"
      onClick={() => onChange('templates')}
      title="Layers"
      aria-controls="properties-panel"
      aria-expanded={isOpen && activeTool === 'templates'}
    >
      <Layers3 size={18} />
    </button>
  </nav>
)

const Section = ({ title, children, compact = false }: { title: string; children: ReactNode; compact?: boolean }) => (
  <section className={`panel-section${compact ? ' panel-section--compact' : ''}`}>
    <h3>{title}</h3>
    {children}
  </section>
)

const FieldLabel = ({ children, value }: { children: ReactNode; value?: ReactNode }) => (
  <div className="field-label"><span>{children}</span>{value && <strong>{value}</strong>}</div>
)

const ColorField = ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
  <label className="color-field">
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    <span style={{ background: value }} />
    <strong>{value.toUpperCase()}</strong>
    <small>{label}</small>
  </label>
)

const TemplatePreview = ({ id }: { id: TemplateId }) => (
  <div className={`template-preview template-preview--${id}`}>
    <span className="mini-title">{id === 'ink' ? 'Build\nvisuals.' : id === 'paper' ? 'Your best\nwork.' : id === 'lime' ? 'Launch\nready.' : 'One\ncanvas.'}</span>
    <span className="mini-phone"><i /></span>
    <span className="mini-orb" />
  </div>
)

const TemplatesPanel = ({ onApplyTemplate }: { onApplyTemplate: (id: TemplateId) => void }) => (
  <>
    <div className="panel-heading">
      <div><span>STARTING POINT</span><h2>Templates</h2></div>
      <p>A look you can make your own in seconds.</p>
    </div>
    <div className="template-grid">
      {templateMeta.map((template) => (
        <button className="template-card" key={template.id} onClick={() => onApplyTemplate(template.id)}>
          <TemplatePreview id={template.id} />
          <span><strong>{template.name}</strong><small>{template.eyebrow}</small></span>
          <Plus size={15} />
        </button>
      ))}
    </div>
    <p className="panel-hint">Templates apply to the selected screen and replace its current content.</p>
  </>
)

const ElementsPanel = ({ onAddShape }: {
  onAddShape: (shape: ShapeElement['shape']) => void
}) => (
  <>
    <div className="panel-heading"><div><span>VECTORS</span><h2>Elements</h2></div><p>Shapes, accents, arrows, and lines for clearer stories.</p></div>
    <div className="shape-library">
      {(['Base', 'Accent', 'Lines'] as const).map((group) => (
        <div className="shape-library-group" key={group}>
          <FieldLabel>{group}</FieldLabel>
          <div className="shape-grid">
            {shapeCatalog.filter((shape) => shape.group === group).map((shape) => {
              const preview: ShapeElement = {
                id: `preview-${shape.id}`,
                type: 'shape',
                x: 0,
                y: 0,
                width: 100,
                rotation: 0,
                opacity: 1,
                shape: shape.id,
                color: '#292923',
                strokeColor: '#292923',
                strokeWidth: ['line', 'arrow', 'wave', 'ring', 'checkmark'].includes(shape.id) ? 7 : 0,
                shadow: 0,
              }
              return (
                <button key={shape.id} onClick={() => onAddShape(shape.id)} title={`Add ${shape.label}`}>
                  <span><ShapeGraphic element={preview} /></span>
                  <small>{shape.label}</small>
                  <Plus size={12} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
    <p className="panel-hint">Click a shape to add it to the active screen.</p>
  </>
)

const IconsPanel = ({ onAddIcon }: {
  onAddIcon: (iconId: string) => void
}) => (
  <>
    <div className="panel-heading"><div><span>VECTORS</span><h2>Icons</h2></div><p>Crisp Hugeicons for features, ratings, and accents.</p></div>
    <IconPicker onSelect={onAddIcon} />
    <p className="panel-hint">Click an icon to add it to the active screen.</p>
  </>
)

const DevicePanel = ({ onAddDevice }: {
  onAddDevice: (style: Extract<CanvasElement, { type: 'device' }>['deviceStyle']) => void
}) => (
  <>
    <div className="panel-heading"><div><span>DEVICES</span><h2>Mockups</h2></div><p>Realistic frames with clean screenshot masks.</p></div>
    <div className="device-grid">
      {deviceOptions.map((device) => (
        <button
          key={device.id}
          onClick={() => onAddDevice(device.id)}
        >
          <span className="device-swatch" style={{ backgroundImage: `url(${device.preview})` }}><i /></span>
          <small>{device.label}</small>
        </button>
      ))}
    </div>
    <p className="panel-hint">Choose a mockup to add it to the active screen.</p>
  </>
)

const backgroundPatterns: { id: BackgroundPattern; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'waves', label: 'Waves' },
]

const BackgroundFillControls = ({
  background,
  uploads,
  onUpdate,
  onUploadBackground,
}: {
  background: Background
  uploads: UploadAsset[]
  onUpdate: (patch: Partial<Background>) => void
  onUploadBackground: (file: File) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Section title="Fill">
      <div className="choice-row choice-row--four">
        <button className={background.type === 'solid' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'solid' })}>Solid</button>
        <button className={background.type === 'gradient' && background.gradientKind !== 'radial' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'gradient', gradientKind: 'linear' })}>Linear</button>
        <button className={background.type === 'gradient' && background.gradientKind === 'radial' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'gradient', gradientKind: 'radial' })}>Radial</button>
        <button className={background.type === 'image' ? 'is-active' : ''} onClick={() => onUpdate({ type: 'image' })}>Image</button>
      </div>
      {background.type !== 'image' && (
        <>
          <ColorField value={background.color1} onChange={(color1) => onUpdate({ color1 })} label={background.type === 'gradient' ? 'Start' : 'Color'} />
          {background.type === 'gradient' && (
            <>
              <ColorField value={background.color2} onChange={(color2) => onUpdate({ color2 })} label="End" />
              {background.gradientKind !== 'radial' && <div className="range-stack"><FieldLabel value={`${background.angle}°`}>Angle</FieldLabel><input type="range" min="0" max="360" value={background.angle} onChange={(event) => onUpdate({ angle: Number(event.target.value) })} /></div>}
            </>
          )}
        </>
      )}
      {background.type === 'image' && (
        <div className="background-image-controls">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => event.target.files?.[0] && onUploadBackground(event.target.files[0])} />
          <button className="upload-drop background-upload" onClick={() => inputRef.current?.click()}>
            {background.image ? <img src={background.image} alt="Current background" /> : <ImagePlus size={20} />}
            <span><strong>{background.image ? 'Replace background' : 'Upload background'}</strong><small>PNG, JPG, or WebP</small></span>
          </button>
          {uploads.length > 0 && (
            <div className="background-asset-grid">
              {uploads.slice(0, 8).map((asset) => <button key={asset.id} className={background.image === asset.src ? 'is-selected' : ''} onClick={() => onUpdate({ type: 'image', image: asset.src })}><img src={asset.src} alt={asset.name} /></button>)}
            </div>
          )}
          <FieldLabel>Image fit</FieldLabel>
          <div className="choice-row">
            <button className={(background.imageFit ?? 'cover') === 'cover' ? 'is-active' : ''} onClick={() => onUpdate({ imageFit: 'cover' })}>Cover</button>
            <button className={background.imageFit === 'contain' ? 'is-active' : ''} onClick={() => onUpdate({ imageFit: 'contain' })}>Contain</button>
          </div>
          <FieldLabel>Position</FieldLabel>
          <label className="select-field">
            <select value={background.imagePosition ?? 'center'} onChange={(event) => onUpdate({ imagePosition: event.target.value as NonNullable<Background['imagePosition']> })}>
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
            <ChevronDown size={15} />
          </label>
          <ColorField value={background.overlayColor ?? '#111116'} onChange={(overlayColor) => onUpdate({ overlayColor })} label="Overlay" />
          <div className="range-stack">
            <FieldLabel value={`${Math.round((background.overlayOpacity ?? 0.18) * 100)}%`}>Overlay opacity</FieldLabel>
            <input type="range" min="0" max="0.9" step="0.01" value={background.overlayOpacity ?? 0.18} onChange={(event) => onUpdate({ overlayOpacity: Number(event.target.value) })} />
          </div>
        </div>
      )}
    </Section>
  )
}

const BackgroundPanel = ({ background, uploads, onUpdate, onUploadBackground }: {
  background: Background
  uploads: UploadAsset[]
  onUpdate: (patch: Partial<Background>) => void
  onUploadBackground: (file: File) => void
}) => {
  const pattern = background.pattern ?? 'none'
  const previewStyle = { ...getBackgroundStyle(background), ...getBackgroundPatternStyle(background) }

  return (
    <>
      <div className="panel-heading"><div><span>BACKGROUND</span><h2>Background</h2></div><p>Colors, gradients, photos, and graphic patterns for the entire screen.</p></div>
      <div className={`background-preview pattern-surface pattern--${pattern}`} style={previewStyle}><Blend size={20} /></div>
      <BackgroundFillControls
        background={background}
        uploads={uploads}
        onUpdate={onUpdate}
        onUploadBackground={onUploadBackground}
      />
      <Section title="Palettes" compact>
        <div className="palette-grid palette-grid--wide">
          {([
            ['#252435', '#111116'], ['#f2eee5', '#f2eee5'], ['#d8ff55', '#d8ff55'], ['#ff6b4a', '#ffb171'],
            ['#26615d', '#102d2c'], ['#6e57ff', '#ff87cb'], ['#10203a', '#38bdf8'], ['#f8d66d', '#ef8354'],
            ['#1a1a17', '#1a1a17'], ['#f2a7ba', '#fde7d8'], ['#5433ff', '#20bdff'], ['#273c75', '#44bd32'],
          ] as const).map(([a, b]) => <button key={`${a}${b}`} style={{ background: a === b ? a : `linear-gradient(135deg, ${a}, ${b})` }} onClick={() => onUpdate({ type: a === b ? 'solid' : 'gradient', gradientKind: 'linear', color1: a, color2: b })} />)}
        </div>
      </Section>
      <Section title="Patterns" compact>
        <div className="pattern-grid">
          {backgroundPatterns.map((item) => (
            <button key={item.id} className={pattern === item.id ? 'is-active' : ''} onClick={() => onUpdate({ pattern: item.id })}>
              <span className={`pattern-swatch pattern-surface pattern--${item.id}`} style={getBackgroundPatternStyle({ ...background, patternColor: '#252521', patternOpacity: 0.42 })} />
              <small>{item.label}</small>
            </button>
          ))}
        </div>
        {pattern !== 'none' && (
          <>
            <ColorField value={background.patternColor ?? '#ffffff'} onChange={(patternColor) => onUpdate({ patternColor })} label="Pattern" />
            <div className="range-stack">
              <FieldLabel value={`${Math.round((background.patternOpacity ?? 0.12) * 100)}%`}>Opacity</FieldLabel>
              <input type="range" min="0.02" max="0.8" step="0.01" value={background.patternOpacity ?? 0.12} onChange={(event) => onUpdate({ patternOpacity: Number(event.target.value) })} />
              <FieldLabel value={`${background.patternScale ?? 28} px`}>Scale</FieldLabel>
              <input type="range" min="10" max="80" step="1" value={background.patternScale ?? 28} onChange={(event) => onUpdate({ patternScale: Number(event.target.value) })} />
            </div>
          </>
        )}
      </Section>
    </>
  )
}

const UploadsPanel = ({ uploads, onUpload, onAddImage, onSetDeviceImage }: {
  uploads: UploadAsset[]
  onUpload: (files: FileList) => void
  onAddImage: (asset: UploadAsset) => void
  onSetDeviceImage: (asset: UploadAsset) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => event.target.files && onUpload(event.target.files)
  return (
    <>
      <div className="panel-heading"><div><span>MEDIA</span><h2>Uploads</h2></div><p>App screenshots and images stay local in your browser.</p></div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={handleFiles} />
      <button className="large-upload" onClick={() => inputRef.current?.click()}><span><Upload size={20} /></span><strong>Upload files</strong><small>PNG, JPG, or WebP · select multiple</small></button>
      {uploads.length
        ? (
            <div className="upload-list">
              {uploads.map((asset) => (
                <div className="upload-asset" key={asset.id}>
                  <img src={asset.src} alt={asset.name} />
                  <div><strong>{asset.name}</strong><span><button onClick={() => onSetDeviceImage(asset)}>Use in mockup</button><button onClick={() => onAddImage(asset)}>Add to canvas</button></span></div>
                </div>
              ))}
            </div>
          )
        : <div className="empty-uploads"><ImagePlus size={24} /><span>No uploads yet</span></div>}
    </>
  )
}

type PropertiesPanelProps = {
  activeTool: ToolId
  activeSlide: Slide
  uploads: UploadAsset[]
  onApplyTemplate: (id: TemplateId) => void
  onAddText: (preset: TextPreset) => void
  onAddDevice: (style: Extract<CanvasElement, { type: 'device' }>['deviceStyle']) => void
  onAddShape: (shape: ShapeElement['shape']) => void
  onAddIcon: (iconId: string) => void
  onUpdateBackground: (patch: Partial<Background>) => void
  onUploadFiles: (files: FileList) => void
  onUploadBackground: (file: File) => void
  onAddImage: (asset: UploadAsset) => void
  onSetDeviceImage: (asset: UploadAsset) => void
}

export const PropertiesPanel = ({ activeTool, activeSlide, uploads, onApplyTemplate, onAddText, onAddDevice, onAddShape, onAddIcon, onUpdateBackground, onUploadFiles, onUploadBackground, onAddImage, onSetDeviceImage }: PropertiesPanelProps) => (
  <aside className="properties-panel" id="properties-panel">
    <div className="panel-scroll">
      {activeTool === 'templates' && <TemplatesPanel onApplyTemplate={onApplyTemplate} />}
      {activeTool === 'elements' && <ElementsPanel onAddShape={onAddShape} />}
      {activeTool === 'icons' && <IconsPanel onAddIcon={onAddIcon} />}
      {activeTool === 'text' && (
        <>
          <div className="panel-heading"><div><span>TYPE</span><h2>Text</h2></div><p>Expressive hierarchy, labels, and quotes for App Store screens.</p></div>
          <div className="text-presets">
            <button onClick={() => onAddText('title')}><strong>Aa</strong><span><b>Headline</b><small>Big & bold</small></span><Plus size={15} /></button>
            <button onClick={() => onAddText('subtitle')}><strong className="preset-subtitle">Aa</strong><span><b>Subheadline</b><small>A clear second line</small></span><Plus size={15} /></button>
            <button onClick={() => onAddText('body')}><strong className="preset-body">Ag</strong><span><b>Body copy</b><small>Explanation & context</small></span><Plus size={15} /></button>
            <button onClick={() => onAddText('label')}><strong className="preset-label">AA</strong><span><b>Label</b><small>Small accents</small></span><Plus size={15} /></button>
            <button onClick={() => onAddText('quote')}><strong className="preset-quote">“</strong><span><b>Quote</b><small>Editorial & human</small></span><Plus size={15} /></button>
            <button onClick={() => onAddText('stat')}><strong className="preset-stat">98</strong><span><b>Stat</b><small>A number that stands out</small></span><Plus size={15} /></button>
          </div>
        </>
      )}
      {activeTool === 'device' && <DevicePanel onAddDevice={onAddDevice} />}
      {activeTool === 'background' && <BackgroundPanel background={activeSlide.background} uploads={uploads} onUpdate={onUpdateBackground} onUploadBackground={onUploadBackground} />}
      {activeTool === 'uploads' && <UploadsPanel uploads={uploads} onUpload={onUploadFiles} onAddImage={onAddImage} onSetDeviceImage={onSetDeviceImage} />}
    </div>
    <div className="panel-footer"><span><i /> Auto-save</span><small>Everything stays local</small></div>
  </aside>
)

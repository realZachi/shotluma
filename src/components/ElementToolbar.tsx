import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { fontOptions } from '../data'
import { deviceOptions, getDevicePlacement } from '../mockups/catalog'
import { strokeOnlyShapes } from '../shapes'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Copy,
  ImagePlus,
  Italic,
  LayoutTwoColumn,
  Lock,
  LockOpen,
  MonitorSmartphone,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Upload,
} from './icons'
import { IconControls, IconSettings } from './IconToolbarControls'
import { percentPresets, type ToolbarPreset } from './toolbar-shared'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Separator } from './ui/separator'
import { Slider } from './ui/slider'
import type { CanvasElement } from '../types'

export type Props = {
  element: CanvasElement
  onUpdate: (patch: Partial<CanvasElement>) => void
  onUploadToDevice: (file: File) => void
  onDuplicate: () => void
  onToggleLock: () => void
  onMoveLayer: (direction: -1 | 1) => void
  onDelete: () => void
}

const elementMeta: Record<CanvasElement['type'], { label: string; icon: ReactNode }> = {
  text: { label: 'Text', icon: <Type size={16} /> },
  device: { label: 'Mockup', icon: <MonitorSmartphone size={16} /> },
  shape: { label: 'Shape', icon: <Shapes size={16} /> },
  image: { label: 'Image', icon: <ImagePlus size={16} /> },
  icon: { label: 'Icon', icon: <Sparkles size={16} /> },
}

export const ToolbarRange = ({ label, value, min, max, step = 1, displayValue, triggerValue, presets, className, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  displayValue?: string
  triggerValue?: string
  presets?: ToolbarPreset[]
  className?: string
  onChange: (value: number) => void
}) => {
  const formattedValue = displayValue ?? (Number.isInteger(value) ? String(value) : value.toFixed(2))

  return (
    <Popover>
      <PopoverTrigger
        render={(
          <Button
            variant="outline"
            size="sm"
            className={`toolbar-control-trigger${className ? ` ${className}` : ''}`}
            aria-label={`${label}: ${formattedValue}`}
          />
        )}
      >
        <span>{label}</span>
        <strong>{triggerValue ?? formattedValue}</strong>
        <ChevronDown className="toolbar-control-chevron" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={9} className="toolbar-control-popover">
        <PopoverHeader className="toolbar-control-popover-header">
          <PopoverTitle>{label}</PopoverTitle>
          <strong>{formattedValue}</strong>
        </PopoverHeader>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(next) => onChange(
            typeof next === 'number' ? next : (next[0] ?? value),
          )}
          aria-label={label}
        />
        <div className="toolbar-range-limits" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        {presets && (
          <div className="toolbar-range-presets" aria-label={`${label} quick values`}>
            {presets.map((preset) => (
              <Button
                key={`${preset.label}-${preset.value}`}
                variant={Math.abs(value - preset.value) < step / 2 ? 'secondary' : 'outline'}
                size="xs"
                onClick={() => onChange(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const colorPresets = [
  '#111116',
  '#ffffff',
  '#777064',
  '#d8ff55',
  '#ff5a36',
  '#ffb171',
  '#2563eb',
  '#7c5cff',
  '#10b981',
  '#f43f5e',
]

export const ToolbarColor = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <Popover>
    <PopoverTrigger render={<Button variant="outline" size="sm" className="toolbar-color" aria-label={`${label}: ${value}`} />}>
      <span className="toolbar-color-swatch" style={{ backgroundColor: value }} />
      <small>{label}</small>
      <ChevronDown className="toolbar-control-chevron" />
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={9} className="toolbar-color-popover">
      <PopoverHeader className="toolbar-control-popover-header">
        <PopoverTitle>{label}</PopoverTitle>
        <strong>{value.toUpperCase()}</strong>
      </PopoverHeader>
      <div className="toolbar-color-grid" aria-label={`${label} color picker`}>
        {colorPresets.map((color) => (
          <Button
            key={color}
            variant="ghost"
            size="icon-sm"
            className="toolbar-color-choice"
            data-selected={value.toLowerCase() === color}
            onClick={() => onChange(color)}
            aria-label={color}
            aria-pressed={value.toLowerCase() === color}
          >
            <span style={{ backgroundColor: color }} />
          </Button>
        ))}
      </div>
      <label className="toolbar-native-color">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Choose custom ${label.toLowerCase()}`} />
        <span className="toolbar-color-swatch" style={{ backgroundColor: value }} />
        <strong>Choose custom color</strong>
      </label>
    </PopoverContent>
  </Popover>
)

const AdvancedSlider = ({ label, value, min, max, step = 1, displayValue, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  displayValue?: string
  onChange: (value: number) => void
}) => (
  <div className="toolbar-slider">
    <div><span>{label}</span><strong>{displayValue ?? value}</strong></div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={(next) => onChange(typeof next === 'number' ? next : (next[0] ?? value))} aria-label={label} />
  </div>
)

const BaseSettings = ({ element, onUpdate }: Pick<Props, 'element' | 'onUpdate'>) => (
  <div className="toolbar-popover-section">
    <AdvancedSlider label="Width" value={element.width} min={8} max={140} displayValue={`${Math.round(element.width)}%`} onChange={(width) => onUpdate({ width })} />
    <AdvancedSlider label="Rotation" value={element.rotation} min={-180} max={180} displayValue={`${Math.round(element.rotation)}°`} onChange={(rotation) => onUpdate({ rotation })} />
    <AdvancedSlider label="Opacity" value={element.opacity} min={0.05} max={1} step={0.01} displayValue={`${Math.round(element.opacity * 100)}%`} onChange={(opacity) => onUpdate({ opacity })} />
  </div>
)

const TextSettings = ({ element, onUpdate }: {
  element: Extract<CanvasElement, { type: 'text' }>
  onUpdate: Props['onUpdate']
}) => (
  <div className="toolbar-popover-section">
    <strong className="toolbar-popover-heading">Text details</strong>
    <AdvancedSlider label="Line height" value={element.lineHeight} min={0.7} max={1.8} step={0.02} displayValue={element.lineHeight.toFixed(2)} onChange={(lineHeight) => onUpdate({ lineHeight })} />
    <AdvancedSlider label="Font weight" value={element.fontWeight} min={100} max={900} step={50} onChange={(fontWeight) => onUpdate({ fontWeight })} />
    <div className="toolbar-transform-control">
      <span>Case</span>
      <div className="toolbar-button-group">
        <Button variant={(element.textTransform ?? 'none') === 'none' ? 'secondary' : 'ghost'} size="sm" onClick={() => onUpdate({ textTransform: 'none' })}>Aa</Button>
        <Button variant={element.textTransform === 'uppercase' ? 'secondary' : 'ghost'} size="sm" onClick={() => onUpdate({ textTransform: 'uppercase' })}>AA</Button>
        <Button variant={element.textTransform === 'lowercase' ? 'secondary' : 'ghost'} size="sm" onClick={() => onUpdate({ textTransform: 'lowercase' })}>aa</Button>
      </div>
    </div>
    <AdvancedSlider label="Tracking" value={element.letterSpacing} min={-4} max={8} step={0.1} displayValue={`${element.letterSpacing.toFixed(1)} px`} onChange={(letterSpacing) => onUpdate({ letterSpacing })} />
    <ToolbarColor label="Text background" value={element.backgroundColor ?? '#ffffff'} onChange={(backgroundColor) => onUpdate({ backgroundColor })} />
    <AdvancedSlider label="Background opacity" value={element.backgroundOpacity ?? 0} min={0} max={1} step={0.01} displayValue={`${Math.round((element.backgroundOpacity ?? 0) * 100)}%`} onChange={(backgroundOpacity) => onUpdate({ backgroundOpacity })} />
    <AdvancedSlider label="Padding" value={element.padding ?? 0} min={0} max={24} displayValue={`${element.padding ?? 0} px`} onChange={(padding) => onUpdate({ padding })} />
    <AdvancedSlider label="Corners" value={element.borderRadius ?? 0} min={0} max={40} displayValue={`${element.borderRadius ?? 0} px`} onChange={(borderRadius) => onUpdate({ borderRadius })} />
    <ToolbarColor label="Stroke" value={element.strokeColor ?? '#111116'} onChange={(strokeColor) => onUpdate({ strokeColor })} />
    <AdvancedSlider label="Stroke width" value={element.strokeWidth ?? 0} min={0} max={3} step={0.25} displayValue={`${element.strokeWidth ?? 0} px`} onChange={(strokeWidth) => onUpdate({ strokeWidth })} />
    <AdvancedSlider label="Text shadow" value={element.shadow ?? 0} min={0} max={100} displayValue={`${element.shadow ?? 0}%`} onChange={(shadow) => onUpdate({ shadow })} />
    <ToolbarColor label="Shadow color" value={element.shadowColor ?? '#000000'} onChange={(shadowColor) => onUpdate({ shadowColor })} />
  </div>
)

const ShapeSettings = ({ element, onUpdate }: {
  element: Extract<CanvasElement, { type: 'shape' }>
  onUpdate: Props['onUpdate']
}) => (
  <div className="toolbar-popover-section">
    <strong className="toolbar-popover-heading">Shape details</strong>
    {/* `ShapeGraphic` never reads `strokeColor` for these line-only shapes
        (their visible color is `color`, shown as "Fill"/"Color" in the main
        toolbar), so this picker must stay hidden here or it silently does
        nothing. */}
    {!strokeOnlyShapes.has(element.shape) && (
      <ToolbarColor label="Stroke" value={element.strokeColor ?? '#171713'} onChange={(strokeColor) => onUpdate({ strokeColor })} />
    )}
    <AdvancedSlider label="Stroke width" value={element.strokeWidth ?? 0} min={0} max={12} displayValue={`${element.strokeWidth ?? 0} px`} onChange={(strokeWidth) => onUpdate({ strokeWidth })} />
    <AdvancedSlider label="Shadow" value={element.shadow ?? 0} min={0} max={100} displayValue={`${element.shadow ?? 0}%`} onChange={(shadow) => onUpdate({ shadow })} />
  </div>
)

const ImageSettings = ({ element, onUpdate }: {
  element: Extract<CanvasElement, { type: 'image' }>
  onUpdate: Props['onUpdate']
}) => (
  <div className="toolbar-popover-section">
    <strong className="toolbar-popover-heading">Image details</strong>
    <AdvancedSlider label="Corners" value={element.borderRadius} min={0} max={50} displayValue={`${element.borderRadius}%`} onChange={(borderRadius) => onUpdate({ borderRadius })} />
    <AdvancedSlider label="Shadow" value={element.shadow ?? 0} min={0} max={100} displayValue={`${element.shadow ?? 0}%`} onChange={(shadow) => onUpdate({ shadow })} />
  </div>
)

const DeviceSettings = ({ element, onUpdate }: {
  element: Extract<CanvasElement, { type: 'device' }>
  onUpdate: Props['onUpdate']
}) => (
  <div className="toolbar-popover-section">
    <strong className="toolbar-popover-heading">Perspective</strong>
    <AdvancedSlider label="Side tilt" value={element.tiltY} min={-18} max={18} displayValue={`${element.tiltY}°`} onChange={(tiltY) => onUpdate({ tiltY })} />
    <AdvancedSlider label="Vertical tilt" value={element.tiltX} min={-12} max={12} displayValue={`${element.tiltX}°`} onChange={(tiltX) => onUpdate({ tiltX })} />
    <AdvancedSlider label="Shadow" value={element.shadow} min={0} max={100} displayValue={`${element.shadow}%`} onChange={(shadow) => onUpdate({ shadow })} />
  </div>
)

const ElementSpecificSettings = ({ element, onUpdate }: Pick<Props, 'element' | 'onUpdate'>) => {
  if (element.type === 'text') return <TextSettings element={element} onUpdate={onUpdate} />
  if (element.type === 'shape') return <ShapeSettings element={element} onUpdate={onUpdate} />
  if (element.type === 'image') return <ImageSettings element={element} onUpdate={onUpdate} />
  if (element.type === 'icon') return <IconSettings element={element} onUpdate={onUpdate} />
  return <DeviceSettings element={element} onUpdate={onUpdate} />
}

const MoreSettings = ({ element, onUpdate }: Pick<Props, 'element' | 'onUpdate'>) => (
  <Popover>
    <PopoverTrigger render={<Button variant="outline" size="icon-sm" className="toolbar-more" title="More settings" aria-label="More settings" />}>
      <SlidersHorizontal size={15} />
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={9} className="element-settings-popover">
      <PopoverHeader>
        <PopoverTitle>More settings</PopoverTitle>
      </PopoverHeader>
      <BaseSettings element={element} onUpdate={onUpdate} />
      <ElementSpecificSettings element={element} onUpdate={onUpdate} />
    </PopoverContent>
  </Popover>
)

const TextControls = ({ element, onUpdate }: { element: Extract<CanvasElement, { type: 'text' }>; onUpdate: Props['onUpdate'] }) => {
  const isBold = element.fontWeight >= 700
  const fontCategories = [...new Set(fontOptions.map((font) => font.category))]
  const weightLabel = element.fontWeight < 350
    ? 'Light'
    : element.fontWeight < 550
      ? 'Normal'
      : element.fontWeight < 675
        ? 'Semibold'
        : element.fontWeight < 825
          ? 'Bold'
          : 'Black'

  return (
    <>
      <Select value={element.fontFamily} onValueChange={(fontFamily) => onUpdate({ fontFamily: String(fontFamily) })}>
        <SelectTrigger size="sm" className="toolbar-font" aria-label="Font family">
          <SelectValue>{fontOptions.find((font) => font.value === element.fontFamily)?.name ?? element.fontFamily}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="toolbar-select-content">
          {fontCategories.map((category) => (
            <SelectGroup key={category}>
              <SelectLabel>{category}</SelectLabel>
              {fontOptions.filter((font) => font.category === category).map((font) => <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>)}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <ToolbarRange
        label="Size"
        value={element.fontSize}
        min={6}
        max={120}
        displayValue={`${Math.round(element.fontSize)} px`}
        presets={[
          { label: '12', value: 12 },
          { label: '16', value: 16 },
          { label: '24', value: 24 },
          { label: '32', value: 32 },
          { label: '48', value: 48 },
          { label: '64', value: 64 },
        ]}
        onChange={(fontSize) => onUpdate({ fontSize })}
      />
      <ToolbarRange
        className="toolbar-text-weight"
        label="Weight"
        value={element.fontWeight}
        min={100}
        max={900}
        step={10}
        displayValue={String(Math.round(element.fontWeight))}
        triggerValue={weightLabel}
        presets={[
          { label: 'Light', value: 300 },
          { label: 'Normal', value: 450 },
          { label: 'Semibold', value: 600 },
          { label: 'Bold', value: 750 },
          { label: 'Black', value: 900 },
        ]}
        onChange={(fontWeight) => onUpdate({ fontWeight })}
      />
      <ToolbarColor label="Text color" value={element.color} onChange={(color) => onUpdate({ color })} />
      <div className="toolbar-button-group" aria-label="Text alignment">
        <Button variant={element.align === 'left' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ align: 'left' })} aria-label="Align left"><AlignLeft /></Button>
        <Button variant={element.align === 'center' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ align: 'center' })} aria-label="Align center"><AlignCenter /></Button>
        <Button variant={element.align === 'right' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ align: 'right' })} aria-label="Align right"><AlignRight /></Button>
      </div>
      <div className="toolbar-button-group" aria-label="Font style">
        <Button className="toolbar-format-button" variant={isBold ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ fontWeight: isBold ? 450 : 750 })} aria-label="Bold" aria-pressed={isBold}><Bold /></Button>
        <Button className="toolbar-format-button" variant={element.italic ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ italic: !element.italic })} aria-label="Italic" aria-pressed={element.italic}><Italic /></Button>
        <Button className="toolbar-format-button" variant={element.underline ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ underline: !element.underline })} aria-label="Underline" aria-pressed={element.underline}><Underline /></Button>
        <Button className="toolbar-format-button" variant={element.strikethrough ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => onUpdate({ strikethrough: !element.strikethrough })} aria-label="Strikethrough" aria-pressed={element.strikethrough}><Strikethrough /></Button>
      </div>
    </>
  )
}

const DeviceControls = ({ element, onUpdate, onUpload }: {
  element: Extract<CanvasElement, { type: 'device' }>
  onUpdate: Props['onUpdate']
  onUpload: (file: File) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <Select
        value={element.deviceStyle}
        onValueChange={(value) => {
          const deviceStyle = deviceOptions.find((device) => device.id === value)?.id
          if (!deviceStyle) return
          onUpdate({ deviceStyle, ...getDevicePlacement(deviceStyle) })
        }}
      >
        <SelectTrigger size="sm" className="toolbar-device-select" aria-label="Mockup style">
          <SelectValue>{deviceOptions.find((device) => device.id === element.deviceStyle)?.label ?? element.deviceStyle}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          {deviceOptions.map((device) => <SelectItem key={device.id} value={device.id}>{device.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        {element.screenshot ? <ImagePlus /> : <Upload />}
        {element.screenshot ? 'Replace screenshot' : 'Add screenshot'}
      </Button>
      <ToolbarRange label="Shadow" value={element.shadow} min={0} max={100} displayValue={`${Math.round(element.shadow)}%`} presets={percentPresets} onChange={(shadow) => onUpdate({ shadow })} />
      <Button
        variant={element.spansScreens ? 'secondary' : 'ghost'}
        size="icon-sm"
        onClick={() => onUpdate({ spansScreens: !element.spansScreens })}
        title="Continue across neighboring screens"
        aria-label="Continue across neighboring screens"
        aria-pressed={element.spansScreens === true}
      >
        <LayoutTwoColumn size={15} />
      </Button>
    </>
  )
}

export const ElementToolbar = ({ element, onUpdate, onUploadToDevice, onDuplicate, onToggleLock, onMoveLayer, onDelete }: Props) => {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const meta = elementMeta[element.type]

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    const controls = controlsRef.current
    const actions = actionsRef.current
    if (!toolbar || !controls || !actions) return

    const contentWidth = 48 + controls.scrollWidth + actions.scrollWidth + 2
    toolbar.style.width = `${Math.ceil(contentWidth)}px`
  }, [element])

  return (
    <div ref={toolbarRef} className="context-toolbar" role="toolbar" aria-label={`Edit ${meta.label}`}>
      <div className="context-toolbar-identity">
        <span>{meta.icon}</span>
        <div><strong>{meta.label}</strong><small>Selected</small></div>
      </div>
      <div ref={controlsRef} className="context-toolbar-controls">
        {element.type === 'text' && <TextControls element={element} onUpdate={onUpdate} />}
        {element.type === 'shape' && (
          <>
            <ToolbarColor
              label={strokeOnlyShapes.has(element.shape) ? 'Color' : 'Fill'}
              value={element.color}
              onChange={(color) => onUpdate({ color })}
            />
            {/* `ShapeGraphic` renders ring/line/arrow/wave as a single
                colored line using `color` only; `strokeColor` is never read
                for them, so this picker would silently do nothing. */}
            {!strokeOnlyShapes.has(element.shape) && (
              <ToolbarColor label="Stroke" value={element.strokeColor ?? '#171713'} onChange={(strokeColor) => onUpdate({ strokeColor })} />
            )}
            <ToolbarRange
              label="Stroke"
              value={element.strokeWidth ?? 0}
              min={0}
              max={12}
              step={0.5}
              displayValue={`${element.strokeWidth ?? 0} px`}
              presets={[
                { label: 'None', value: 0 },
                { label: '1', value: 1 },
                { label: '2', value: 2 },
                { label: '4', value: 4 },
                { label: '8', value: 8 },
                { label: '12', value: 12 },
              ]}
              onChange={(strokeWidth) => onUpdate({ strokeWidth })}
            />
            <ToolbarRange label="Shadow" value={element.shadow ?? 0} min={0} max={100} displayValue={`${Math.round(element.shadow ?? 0)}%`} presets={percentPresets} onChange={(shadow) => onUpdate({ shadow })} />
          </>
        )}
        {element.type === 'image' && (
          <>
            <ToolbarRange
              label="Corners"
              value={element.borderRadius}
              min={0}
              max={50}
              displayValue={`${Math.round(element.borderRadius)}%`}
              presets={[
                { label: 'Square', value: 0 },
                { label: 'Slight', value: 8 },
                { label: 'Rounded', value: 24 },
                { label: 'Max', value: 50 },
              ]}
              onChange={(borderRadius) => onUpdate({ borderRadius })}
            />
            <ToolbarRange label="Shadow" value={element.shadow ?? 0} min={0} max={100} displayValue={`${Math.round(element.shadow ?? 0)}%`} presets={percentPresets} onChange={(shadow) => onUpdate({ shadow })} />
            <ToolbarRange
              label="Opacity"
              value={Math.round(element.opacity * 100)}
              min={5}
              max={100}
              displayValue={`${Math.round(element.opacity * 100)}%`}
              presets={[
                { label: '25', value: 25 },
                { label: '50', value: 50 },
                { label: '75', value: 75 },
                { label: '100', value: 100 },
              ]}
              onChange={(opacity) => onUpdate({ opacity: opacity / 100 })}
            />
          </>
        )}
        {element.type === 'device' && <DeviceControls element={element} onUpdate={onUpdate} onUpload={onUploadToDevice} />}
        {element.type === 'icon' && <IconControls element={element} onUpdate={onUpdate} />}
        <MoreSettings element={element} onUpdate={onUpdate} />
      </div>
      <div ref={actionsRef} className="context-toolbar-actions">
        <Separator orientation="vertical" />
        <Button variant="ghost" size="icon-sm" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate"><Copy /></Button>
        <Button variant={element.locked ? 'secondary' : 'ghost'} size="icon-sm" onClick={onToggleLock} title={element.locked ? 'Unlock' : 'Lock'} aria-label={element.locked ? 'Unlock' : 'Lock'}>
          {element.locked ? <LockOpen /> : <Lock />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onMoveLayer(-1)} title="Send backward" aria-label="Send backward"><ArrowDown /></Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onMoveLayer(1)} title="Bring forward" aria-label="Bring forward"><ArrowUp /></Button>
        <Button variant="destructive" size="icon-sm" onClick={onDelete} title="Delete" aria-label="Delete"><Trash2 /></Button>
      </div>
    </div>
  )
}

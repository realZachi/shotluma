import { CursorMagicSelection02 } from './icons'

type AiCursorActivity = { tool: string; x?: number; y?: number; seq: number }

type Props = {
  activity: AiCursorActivity
}

const LABELS: Record<string, string> = {
  add_text: 'Text',
  add_device: 'Device',
  add_shape: 'Shape',
  add_image: 'Image',
  add_slide: 'New screen',
  add_slides: 'New screens',
  rename_slide: 'Rename',
  set_slide_background: 'Background',
  set_device_screenshot: 'Screenshot',
  update_element: 'Refining',
  delete_element: 'Cleaning up',
  delete_slide: 'Cleaning up',
  inspect_slide: 'Checking layout',
  render_slide_preview: 'Checking preview',
}

export const AiCursorOverlay = ({ activity }: Props) => {
  const label = LABELS[activity.tool] ?? 'Working'
  return (
    <div className="ai-cursor-layer" data-ai-overlay="true" aria-hidden="true">
      <div className="ai-cursor" style={{ left: `${activity.x ?? 50}%`, top: `${activity.y ?? 30}%` }}>
        <span className="ai-cursor-ripple" key={activity.seq} />
        <CursorMagicSelection02 size={18} />
        <span className="ai-cursor-label">AI · {label}</span>
      </div>
    </div>
  )
}

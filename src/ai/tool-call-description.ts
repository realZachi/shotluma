import { parsePlanInput } from './run-plan'

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value

const STATIC_TOOL_DETAILS = new Map<string, string>([
  ['get_canvas_state', 'Canvas state retrieved'],
  ['add_slide', 'New screen created'],
  ['set_slide_background', 'Background updated'],
  ['delete_slide', 'Screen deleted'],
  ['add_image', 'Image added'],
  ['set_device_screenshot', 'Device screenshot replaced'],
  ['update_element', 'Element updated'],
  ['delete_element', 'Element deleted'],
  ['inspect_slide', 'Layout measured'],
  ['render_slide_preview', 'Preview checked'],
  ['remove_asset_background', 'Overlay background removed'],
])

export const describeAiToolCall = (toolName: string, input: unknown): string => {
  const staticDetail = STATIC_TOOL_DETAILS.get(toolName)
  if (staticDetail !== undefined) return staticDetail

  const data = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  switch (toolName) {
    case 'declare_plan': {
      const count = parsePlanInput(input).length
      return count > 0 ? `Plan declared: ${count} screens` : 'Plan declared'
    }
    case 'rename_slide':
      return typeof data['name'] === 'string'
        ? `Screen renamed: “${truncate(data['name'], 30)}”`
        : 'Screen renamed'
    case 'add_text':
      return typeof data['text'] === 'string'
        ? `Text: “${truncate(data['text'], 30)}”`
        : 'Text added'
    case 'add_device':
      return typeof data['deviceStyle'] === 'string'
        ? `Device added (${data['deviceStyle']})`
        : 'Device added'
    case 'add_shape':
      return typeof data['shape'] === 'string'
        ? `Shape added (${data['shape']})`
        : 'Shape added'
    case 'create_overlay_asset':
      return typeof data['name'] === 'string'
        ? `Overlay asset: “${truncate(data['name'], 30)}”`
        : typeof data['prompt'] === 'string'
          ? `Overlay asset: “${truncate(data['prompt'], 30)}”`
          : 'Overlay asset generated'
    default:
      return `Tool: ${toolName}`
  }
}

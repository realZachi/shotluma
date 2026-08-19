import { createHtmlScreenTools } from './html-tools'
import { createAddIconTool } from './icon-tool'
import { createInspectionTools } from './inspection-tools'
import { createMediaTools } from './media-tools'
import { createOverlayAssetTools } from './overlay-asset-tools'
import { createDeclarePlanTool } from './plan-tool'
import { createSlideTools } from './slide-tools'
import { createAddTextTool } from './text-tool'
import {
  createToolContext,
  type AiToolActivity,
} from './tool-context'
import { createUpdateElementTool } from './update-element-tool'
import type { AiEditorController } from './controller'

export type { AiToolActivity } from './tool-context'

type EditorToolOptions = {
  mode?: 'generate' | 'edit'
  /** When true, expose the experimental HTML screen toolset instead of the element tools. */
  htmlScreens?: boolean
  onActivity?: (activity: AiToolActivity) => void
  /** When true, expose gpt-image-2 overlay asset tools (requires OpenAI key). */
  enableOverlayAssets?: boolean
  abortSignal?: AbortSignal
}

function createHtmlModeTools(
  context: ReturnType<typeof createToolContext>,
  mode: 'generate' | 'edit',
) {
  const slideTools = createSlideTools(context)
  const { render_slide_preview: renderSlidePreview } = createInspectionTools(context, { mode })
  const htmlTools = createHtmlScreenTools(context)
  const editTools = {
    get_canvas_state: slideTools.get_canvas_state,
    rename_slide: slideTools.rename_slide,
    set_screen_html: htmlTools.set_screen_html,
    patch_screen_html: htmlTools.patch_screen_html,
    render_slide_preview: renderSlidePreview,
  }

  if (mode === 'edit') return editTools
  return {
    ...editTools,
    add_html_screen: htmlTools.add_html_screen,
    delete_slide: slideTools.delete_slide,
    declare_plan: createDeclarePlanTool(context),
  }
}

export function createEditorTools(
  controller: AiEditorController,
  options?: EditorToolOptions,
) {
  const context = createToolContext(controller, options?.onActivity)
  if (options?.htmlScreens) {
    return createHtmlModeTools(context, options.mode ?? 'generate')
  }
  const mode = options?.mode ?? 'generate'
  const inspectionTools = createInspectionTools(context, { mode })
  const {
    get_canvas_state: getCanvasState,
    add_slides: addSlides,
    delete_slide: deleteSlide,
    ...sharedSlideTools
  } = createSlideTools(context)
  const overlayTools = options?.enableOverlayAssets
    ? createOverlayAssetTools(context, {
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      })
    : {}
  const sharedTools = {
    ...sharedSlideTools,
    add_text: createAddTextTool(context),
    add_icon: createAddIconTool(context),
    ...createMediaTools(context),
    update_element: createUpdateElementTool(context),
    ...inspectionTools,
    ...overlayTools,
  }

  if (mode === 'edit') {
    return {
      get_canvas_state: getCanvasState,
      ...sharedTools,
    }
  }
  return {
    ...sharedTools,
    add_slides: addSlides,
    delete_slide: deleteSlide,
    declare_plan: createDeclarePlanTool(context),
  }
}

export type EditorTools = ReturnType<typeof createEditorTools>

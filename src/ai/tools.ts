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
  onActivity?: (activity: AiToolActivity) => void
  /** When true, expose gpt-image-2 overlay asset tools (requires OpenAI key). */
  enableOverlayAssets?: boolean
  abortSignal?: AbortSignal
}

export function createEditorTools(
  controller: AiEditorController,
  options?: EditorToolOptions,
) {
  const context = createToolContext(controller, options?.onActivity)
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

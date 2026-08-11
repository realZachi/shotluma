import { tool } from 'ai'
import { z } from 'zod'
import { clamp } from '../utils'
import { measureSlide } from './measure'
import { captureSlidePreview } from './preview'
import {
  buildElementTypes,
  elementNotFoundMessage,
  getElement,
  getSlide,
  notFound,
  numberField,
  slideNotFoundMessage,
  type ToolContext,
} from './tool-context'

export const PREVIEW_LIMITS = { generate: 3, edit: 4 } as const

export const reservePreviewAttempt = (
  counts: Map<string, number>,
  slideId: string,
  limit: number,
): boolean => {
  const count = counts.get(slideId) ?? 0
  if (count >= limit) return false
  counts.set(slideId, count + 1)
  return true
}

export const createInspectionTools = (
  { controller, emit }: ToolContext,
  options: { mode: 'generate' | 'edit' } = { mode: 'generate' },
) => {
  const previewAttempts = new Map<string, number>()
  const previewLimit = PREVIEW_LIMITS[options.mode]
  const deleteElement = tool({
    description: 'Delete an element from a slide.',
    inputSchema: z.object({
      slideId: z.string(),
      elementId: z.string(),
    }),
    execute: async ({ slideId, elementId }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      const existing = getElement(controller, slideId, elementId)
      emit(existing
        ? {
            tool: 'delete_element',
            slideId,
            elementId,
            x: clamp(
              numberField(existing['x']) + numberField(existing['width']) / 2,
              2,
              98,
            ),
            y: clamp(numberField(existing['y']) + 4, 2, 96),
          }
        : { tool: 'delete_element', slideId })
      if (!controller.deleteElement(slideId, elementId)) {
        return notFound(elementNotFoundMessage(elementId, slideId))
      }
      return { ok: true }
    },
  })

  const inspectSlide = tool({
    description:
      'Get the true rendered bounding box of every element on a slide (x/width as percent of canvas width, y/height as percent of canvas height) plus layout warnings (overflow, overlaps). Rarely needed: every mutating tool already returns the element\'s box and the slide\'s warnings - reach for this only when you need a fresh full snapshot of every box without rendering a preview.',
    inputSchema: z.object({ slideId: z.string() }),
    execute: async ({ slideId }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      emit({ tool: 'inspect_slide', slideId })
      const measurement = await measureSlide(
        slideId,
        buildElementTypes(controller, slideId),
      )
      if (!measurement) return notFound(slideNotFoundMessage(slideId))
      return {
        ok: true,
        boxes: measurement.boxes,
        warnings: measurement.warnings,
      }
    },
  })

  const renderSlidePreview = tool({
    description:
      'Render the slide to an image and return it so you can SEE your actual design. Use it after finishing each slide to check for text overflow, overlaps, poor contrast, and visual consistency with the other slides. Also returns the same layout warnings as inspect_slide.',
    inputSchema: z.object({ slideId: z.string() }),
    execute: async ({
      slideId,
    }): Promise<
      { ok: true; warnings: string[]; image: string; mediaType: 'image/jpeg' }
      | { ok: false; error: string }
    > => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      if (!reservePreviewAttempt(previewAttempts, slideId, previewLimit)) {
        return {
          ok: false,
          error: `Preview limit reached for ${slideId}. Use the existing previews and finish this screen instead of requesting another image.`,
        }
      }
      emit({ tool: 'render_slide_preview', slideId })
      const [capture, measurement] = await Promise.all([
        captureSlidePreview(slideId),
        measureSlide(slideId, buildElementTypes(controller, slideId)),
      ])
      if (!capture) {
        return {
          ok: false,
          error: `Failed to render a preview for slide ${slideId}.`,
        }
      }
      return {
        ok: true,
        warnings: measurement?.warnings ?? [],
        image: capture.base64,
        mediaType: capture.mediaType,
      }
    },
    toModelOutput: ({ output }) => {
      if (!output.ok) return { type: 'text', value: JSON.stringify(output) }
      return {
        type: 'content',
        value: [
          {
            type: 'text',
            text: JSON.stringify({ ok: true, warnings: output.warnings }),
          },
          {
            type: 'file',
            mediaType: output.mediaType,
            data: { type: 'data', data: output.image },
            // A slide preview is a composition/thumbnail check. Measurements
            // already carry exact geometry, so OpenAI's low-detail vision path
            // avoids paying original-resolution image tokens for every repair.
            providerOptions: { openai: { imageDetail: 'low' } },
          },
        ],
      }
    },
  })

  return {
    delete_element: deleteElement,
    inspect_slide: inspectSlide,
    render_slide_preview: renderSlidePreview,
  }
}

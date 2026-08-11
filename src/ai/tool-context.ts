import { clamp } from '../utils'
import { measureSlide, type ElementBox } from './measure'
import type { AiEditorController } from './controller'

export type AiToolActivity = {
  tool: string
  slideId?: string
  elementId?: string
  x?: number
  y?: number
}

export type ToolContext = {
  controller: AiEditorController
  emit: (activity: AiToolActivity) => void
}

export const createToolContext = (
  controller: AiEditorController,
  onActivity?: (activity: AiToolActivity) => void,
): ToolContext => ({
  controller,
  emit: (activity) => {
    try {
      onActivity?.(activity)
    } catch {
      // Activity observers are diagnostic only and must not interrupt editor mutations.
    }
  },
})

export const clampX = (value: number) => clamp(value, -35, 97)
export const clampY = (value: number) => clamp(value, -35, 97)
export const clampWidth = (value: number) => clamp(value, 8, 140)
export const clampFontSize = (value: number) => clamp(value, 6, 120)
export const clampFontWeight = (value: number) => clamp(value, 100, 900)
export const clampLineHeight = (value: number) => clamp(value, 0.7, 1.8)
export const clampLetterSpacing = (value: number) => clamp(value, -4, 8)
export const clampAngle = (value: number) => clamp(value, 0, 360)
export const clampTiltX = (value: number) => clamp(value, -12, 12)
export const clampTiltY = (value: number) => clamp(value, -18, 18)
export const clampShadow = (value: number) => clamp(value, 0, 100)
export const clampBorderRadius = (value: number) => clamp(value, 0, 100)
export const clampTextPadding = (value: number) => clamp(value, 0, 24)
export const clampTextStroke = (value: number) => clamp(value, 0, 3)
export const clampShapeStroke = (value: number) => clamp(value, 0, 12)
export const clampRotation = (value: number) => clamp(value, -180, 180)
export const clampOpacity = (value: number) => clamp(value, 0, 1)
export const clampPatternScale = (value: number) => clamp(value, 10, 80)

export const notFound = (message: string) => ({ ok: false as const, error: message })

export const slideNotFoundMessage = (slideId: string) =>
  `No slide with id ${slideId}. Call get_canvas_state to see current ids.`

export const elementNotFoundMessage = (elementId: string, slideId: string) =>
  `No element with id ${elementId} on slide ${slideId}. Call get_canvas_state to see current ids.`

export const assetNotFoundMessage = (assetId: string) =>
  `No asset with id ${assetId}. Call get_canvas_state to see available asset ids.`

export const getSlide = (controller: AiEditorController, slideId: string) =>
  controller.snapshot().slides.find((slide) => slide.id === slideId)

export const getElement = (
  controller: AiEditorController,
  slideId: string,
  elementId: string,
) => getSlide(controller, slideId)?.elements.find(
  (element) => element['id'] === elementId,
)

export const numberField = (value: unknown): number =>
  typeof value === 'number' ? value : 0

export const buildElementTypes = (
  controller: AiEditorController,
  slideId: string,
): Record<string, string> => {
  const slide = getSlide(controller, slideId)
  if (!slide) return {}

  const types: Record<string, string> = {}
  for (const element of slide.elements) {
    if (typeof element['id'] === 'string' && typeof element['type'] === 'string') {
      types[element['id']] = element['type']
    }
  }
  return types
}

export const warningsForElement = (
  warnings: string[],
  elementId: string,
): string[] => warnings.filter((warning) => warning.includes(` ${elementId} `))

export const withMeasurement = async (
  controller: AiEditorController,
  slideId: string,
  elementId: string,
): Promise<{ box: ElementBox | null; slideWarnings: string[] }> => {
  const measurement = await measureSlide(
    slideId,
    buildElementTypes(controller, slideId),
  )
  const box = measurement?.boxes.find(
    (candidate) => candidate.elementId === elementId,
  ) ?? null
  return {
    box,
    slideWarnings: warningsForElement(measurement?.warnings ?? [], elementId),
  }
}

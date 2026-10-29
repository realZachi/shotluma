import { tool } from 'ai'
import { z } from 'zod'
import { clamp } from '../utils'
import {
  assetNotFoundMessage,
  clampBorderRadius,
  clampOpacity,
  clampRotation,
  clampShadow,
  clampShapeStroke,
  clampTiltX,
  clampTiltY,
  clampWidth,
  clampX,
  clampY,
  elementNotFoundMessage,
  getElement,
  getSlide,
  notFound,
  numberField,
  slideNotFoundMessage,
  withMeasurement,
  type ToolContext,
} from './tool-context'
import {
  COORDINATE_NOTE,
  deviceStyleSchema,
  MEASUREMENT_NOTE,
  screenThemeSchema,
  shapeSchema,
} from './tool-schemas'
import type { DeviceElement, ImageElement, ShapeElement } from '../types'

export const createMediaTools = ({ controller, emit }: ToolContext) => {
  const addDevice = tool({
    description: `Add a device mockup to a slide, optionally pre-loaded with an uploaded screenshot. ${COORDINATE_NOTE} ${MEASUREMENT_NOTE}`,
    inputSchema: z.object({
      slideId: z.string(),
      deviceStyle: deviceStyleSchema,
      screenshotAssetId: z.string().optional().describe('Asset id (from get_canvas_state) of an uploaded screenshot to place inside the device screen.'),
      x: z.number().describe(COORDINATE_NOTE),
      y: z.number().describe(COORDINATE_NOTE),
      width: z.number().describe(COORDINATE_NOTE),
      rotation: z.number().optional().describe('Additional rotation in degrees, -180 to 180. Defaults to 0; the photographic perspective is already baked in.'),
      tiltX: z.number().optional().describe('Reserved device field, -12 to 12. Photo mockups use their baked PSD perspective.'),
      tiltY: z.number().optional().describe('Reserved device field, -18 to 18. Photo mockups use their baked PSD perspective.'),
      shadow: z.number().optional().describe('Reserved device field, 0-100. Photo mockups include their original lighting and shadow.'),
      screenTheme: screenThemeSchema.optional().describe('Defaults to "coral".'),
      opacity: z.number().optional().describe('Opacity from 0 to 1. Defaults to 1.'),
    }),
    execute: async ({
      slideId,
      deviceStyle,
      screenshotAssetId,
      x,
      y,
      width,
      rotation,
      tiltX,
      tiltY,
      shadow,
      screenTheme,
      opacity,
    }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))

      let screenshot: string | undefined
      if (screenshotAssetId !== undefined) {
        screenshot = controller.getAssetSrc(screenshotAssetId)
        if (!screenshot) return notFound(assetNotFoundMessage(screenshotAssetId))
      }
      const element: Omit<DeviceElement, 'id'> = {
        type: 'device',
        x: clampX(x),
        y: clampY(y),
        width: clampWidth(width),
        rotation: clampRotation(rotation ?? 0),
        opacity: clampOpacity(opacity ?? 1),
        deviceStyle,
        screenTheme: screenTheme ?? 'coral',
        tiltX: clampTiltX(tiltX ?? 0),
        tiltY: clampTiltY(tiltY ?? 0),
        shadow: clampShadow(shadow ?? 55),
        ...(screenshot ? { screenshot } : {}),
      }
      emit({
        tool: 'add_device',
        slideId,
        x: clamp(clampX(x) + clampWidth(width) / 2, 2, 98),
        y: clamp(clampY(y) + 4, 2, 96),
      })
      const elementId = controller.addElement(slideId, element)
      if (!elementId) return notFound(slideNotFoundMessage(slideId))
      const { box, slideWarnings } = await withMeasurement(controller, slideId, elementId)
      return { ok: true, elementId, box, slideWarnings }
    },
  })

  const addShape = tool({
    description: `Add a decorative shape accent to a slide. ${COORDINATE_NOTE} ${MEASUREMENT_NOTE}`,
    inputSchema: z.object({
      slideId: z.string(),
      shape: shapeSchema,
      color: z.string().describe('Shape color as a hex string.'),
      strokeColor: z.string().optional().describe('Outline color for filled shapes as a hex string.'),
      strokeWidth: z.number().optional().describe('Outline width, or line thickness for line/ring/arrow/wave/checkmark, 0-12.'),
      shadow: z.number().optional().describe('Drop shadow intensity, 0-100.'),
      x: z.number().describe(COORDINATE_NOTE),
      y: z.number().describe(COORDINATE_NOTE),
      width: z.number().describe(COORDINATE_NOTE),
      rotation: z.number().optional().describe('Rotation in degrees, -180 to 180. Defaults to 0.'),
      opacity: z.number().optional().describe('Opacity from 0 to 1. Defaults to 1.'),
    }),
    execute: async ({
      slideId,
      shape,
      color,
      strokeColor,
      strokeWidth,
      shadow,
      x,
      y,
      width,
      rotation,
      opacity,
    }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      const defaultStrokeWidth = ['line', 'arrow', 'wave', 'checkmark'].includes(shape)
        ? 6
        : shape === 'ring' ? 4 : 0
      const element: Omit<ShapeElement, 'id'> = {
        type: 'shape',
        x: clampX(x),
        y: clampY(y),
        width: clampWidth(width),
        rotation: clampRotation(rotation ?? 0),
        opacity: clampOpacity(opacity ?? 1),
        shape,
        color,
        strokeColor: strokeColor ?? '#171713',
        strokeWidth: clampShapeStroke(strokeWidth ?? defaultStrokeWidth),
        shadow: clampShadow(shadow ?? 10),
      }
      emit({
        tool: 'add_shape',
        slideId,
        x: clamp(clampX(x) + clampWidth(width) / 2, 2, 98),
        y: clamp(clampY(y) + 4, 2, 96),
      })
      const elementId = controller.addElement(slideId, element)
      if (!elementId) return notFound(slideNotFoundMessage(slideId))
      const { box, slideWarnings } = await withMeasurement(controller, slideId, elementId)
      return { ok: true, elementId, box, slideWarnings }
    },
  })

  const addImage = tool({
    description: `Add a free-floating uploaded image to a slide (not inside a device frame). Use this for app logos and other brand marks. ${COORDINATE_NOTE} ${MEASUREMENT_NOTE}`,
    inputSchema: z.object({
      slideId: z.string(),
      assetId: z.string().describe('Asset id (from get_canvas_state) of the uploaded image to place, including app logo assets.'),
      x: z.number().describe(COORDINATE_NOTE),
      y: z.number().describe(COORDINATE_NOTE),
      width: z.number().describe(COORDINATE_NOTE),
      borderRadius: z.number().optional().describe('Corner radius, 0-100. Defaults to 0 (no rounding).'),
      shadow: z.number().optional().describe('Drop shadow intensity, 0-100. Defaults to 0 (no shadow).'),
      rotation: z.number().optional().describe('Rotation in degrees, -180 to 180. Defaults to 0.'),
      opacity: z.number().optional().describe('Opacity from 0 to 1. Defaults to 1.'),
    }),
    execute: async ({
      slideId,
      assetId,
      x,
      y,
      width,
      borderRadius,
      shadow,
      rotation,
      opacity,
    }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      const src = controller.getAssetSrc(assetId)
      if (!src) return notFound(assetNotFoundMessage(assetId))
      const element: Omit<ImageElement, 'id'> = {
        type: 'image',
        x: clampX(x),
        y: clampY(y),
        width: clampWidth(width),
        rotation: clampRotation(rotation ?? 0),
        opacity: clampOpacity(opacity ?? 1),
        src,
        borderRadius: clampBorderRadius(borderRadius ?? 0),
        shadow: clampShadow(shadow ?? 0),
      }
      emit({
        tool: 'add_image',
        slideId,
        x: clamp(clampX(x) + clampWidth(width) / 2, 2, 98),
        y: clamp(clampY(y) + 4, 2, 96),
      })
      const elementId = controller.addElement(slideId, element)
      if (!elementId) return notFound(slideNotFoundMessage(slideId))
      const { box, slideWarnings } = await withMeasurement(controller, slideId, elementId)
      return { ok: true, elementId, box, slideWarnings }
    },
  })

  const setDeviceScreenshot = tool({
    description: `Replace the screenshot shown inside an existing device element. ${MEASUREMENT_NOTE}`,
    inputSchema: z.object({
      slideId: z.string(),
      elementId: z.string(),
      assetId: z.string().describe('Asset id (from get_canvas_state) of the uploaded screenshot to place inside the device.'),
    }),
    execute: async ({ slideId, elementId, assetId }) => {
      if (!getSlide(controller, slideId)) return notFound(slideNotFoundMessage(slideId))
      const element = getElement(controller, slideId, elementId)
      if (!element) return notFound(elementNotFoundMessage(elementId, slideId))
      if (element['type'] !== 'device') {
        return notFound(`Element ${elementId} on slide ${slideId} is not a device element.`)
      }
      const src = controller.getAssetSrc(assetId)
      if (!src) return notFound(assetNotFoundMessage(assetId))

      emit({
        tool: 'set_device_screenshot',
        slideId,
        elementId,
        x: clamp(
          numberField(element['x']) + numberField(element['width']) / 2,
          2,
          98,
        ),
        y: clamp(numberField(element['y']) + 4, 2, 96),
      })
      controller.updateElement(slideId, elementId, { screenshot: src })
      const { box, slideWarnings } = await withMeasurement(controller, slideId, elementId)
      return { ok: true, elementId, box, slideWarnings }
    },
  })

  return {
    add_device: addDevice,
    add_shape: addShape,
    add_image: addImage,
    set_device_screenshot: setDeviceScreenshot,
  }
}

import { photoMockups } from '../mockups/catalog'
import { SPAN_NEIGHBOR_OFFSET, isSpanningDevice } from './screen-span'
import type { CanvasElement } from '../types'

// Elements may hang over the artboard edge, but enough must stay visible to
// remain reachable; large devices only need a small edge inside the artboard.
const DEFAULT_DRAG_MIN = -35
export const DRAG_MAX = 97
const DEVICE_VISIBLE_EDGE = 3
const ARTBOARD_ASPECT_RATIO = 1290 / 2796

export const getDragMinX = (element: CanvasElement) => {
  const base = element.type === 'device'
    ? Math.min(DEFAULT_DRAG_MIN, DEVICE_VISIBLE_EDGE - element.width)
    : DEFAULT_DRAG_MIN
  return isSpanningDevice(element) ? base - SPAN_NEIGHBOR_OFFSET : base
}

export const getDragMaxX = (element: CanvasElement) =>
  isSpanningDevice(element) ? DRAG_MAX + SPAN_NEIGHBOR_OFFSET : DRAG_MAX

export const getDragMinY = (element: CanvasElement, artboardAspectRatio: number = ARTBOARD_ASPECT_RATIO) => {
  if (element.type !== 'device') return DEFAULT_DRAG_MIN
  const height = element.width * artboardAspectRatio / photoMockups[element.deviceStyle].canvasAspectRatio
  return Math.min(DEFAULT_DRAG_MIN, DEVICE_VISIBLE_EDGE - height)
}

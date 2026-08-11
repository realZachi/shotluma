import { describe, expect, it } from 'vitest'
import { createEditorTools } from './tools'
import type { AiEditorController } from './controller'

const controller: AiEditorController = {
  snapshot: () => ({
    canvas: { width: 1290, height: 2796, coordinates: 'percent' },
    slides: [],
    assets: [],
  }),
  addSlide: () => 'slide-1',
  renameSlide: () => true,
  setSlideBackground: () => true,
  deleteSlide: () => true,
  addElement: () => 'element-1',
  updateElement: () => true,
  deleteElement: () => true,
  getAssetSrc: () => undefined,
  addAsset: () => 'asset-1',
}

describe('createEditorTools', () => {
  it('uses one batched screen-creation tool and skips redundant state reads in generate mode', () => {
    const tools = createEditorTools(controller, { mode: 'generate' })

    expect(tools).toHaveProperty('add_slides')
    expect(tools).not.toHaveProperty('add_slide')
    expect(tools).not.toHaveProperty('get_canvas_state')
  })

  it('keeps the scoped canvas read in edit mode without exposing screen creation', () => {
    const tools = createEditorTools(controller, { mode: 'edit' })

    expect(tools).toHaveProperty('get_canvas_state')
    expect(tools).not.toHaveProperty('add_slides')
  })
})

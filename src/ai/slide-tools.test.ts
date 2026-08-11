import { describe, expect, it, vi } from 'vitest'
import { createSlideTools } from './slide-tools'
import type { AiEditorController } from './controller'
import type { ToolContext } from './tool-context'

const createContext = () => {
  const addSlide = vi.fn((input: Parameters<AiEditorController['addSlide']>[0]) =>
    `slide-${input.name ?? 'untitled'}`)
  const controller: AiEditorController = {
    snapshot: () => ({
      canvas: { width: 1290, height: 2796, coordinates: 'percent' },
      slides: [],
      assets: [],
    }),
    addSlide,
    renameSlide: () => true,
    setSlideBackground: () => true,
    deleteSlide: () => true,
    addElement: () => 'element-1',
    updateElement: () => true,
    deleteElement: () => true,
    getAssetSrc: () => undefined,
    addAsset: () => 'asset-1',
  }
  const emit = vi.fn<ToolContext['emit']>()
  return { context: { controller, emit }, addSlide, emit }
}

type AddSlidesTool = ReturnType<typeof createSlideTools>['add_slides']
type ExecuteOptions = Parameters<AddSlidesTool['execute']>[1]

const EXECUTE_OPTIONS = { toolCallId: 'call-1', messages: [] } as unknown as ExecuteOptions

describe('add_slides', () => {
  it('creates the complete plan in one ordered tool execution', async () => {
    const { context, addSlide } = createContext()
    const tool = createSlideTools(context).add_slides

    const result = await tool.execute({
      slides: [
        {
          name: 'Hero',
          background: {
            type: 'gradient',
            color1: '#111111',
            color2: '#222222',
            angle: 450,
          },
        },
        { name: 'Proof' },
      ],
    }, EXECUTE_OPTIONS)

    expect(addSlide).toHaveBeenCalledTimes(2)
    expect(addSlide.mock.calls[0]?.[0]).toMatchObject({
      name: 'Hero',
      background: { angle: 360 },
    })
    expect(addSlide.mock.calls[1]?.[0]).toEqual({ name: 'Proof' })
    expect(result).toMatchObject({
      ok: true,
      slides: [
        { slideId: 'slide-Hero', index: 0 },
        { slideId: 'slide-Proof', index: 1 },
      ],
    })
  })

  it('emits one visible activity for every created screen', async () => {
    const { context, emit } = createContext()
    const tool = createSlideTools(context).add_slides

    await tool.execute({ slides: [{ name: 'Hero' }, { name: 'Proof' }] }, EXECUTE_OPTIONS)

    expect(emit).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tool: 'add_slides',
      slideId: 'slide-Hero',
    }))
  })
})

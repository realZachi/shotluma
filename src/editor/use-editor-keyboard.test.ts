import { describe, expect, it, vi } from 'vitest'
import { makeTemplate } from '../data'
import { handleEditorKeydown, type EditorKeyboardOptions } from './use-editor-keyboard'

describe('handleEditorKeydown', () => {
  const slide = makeTemplate('ink', 'Screen 1')
  const elementId = slide.elements[0]?.id ?? 'el-1'

  const createOptions = (overrides: Partial<EditorKeyboardOptions> = {}): EditorKeyboardOptions => ({
    activeSlide: slide,
    selectedElementIds: [elementId],
    checkpoint: vi.fn(),
    updateElementsLive: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    deleteSelected: vi.fn(),
    ...overrides,
  })

  it('triggers duplicate on Ctrl+D / Cmd+D', () => {
    const onDuplicate = vi.fn()
    const options = createOptions({ onDuplicate })
    const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true })

    handleEditorKeydown(event, options)
    expect(onDuplicate).toHaveBeenCalledTimes(1)
  })

  it('triggers lock toggle on Ctrl+L', () => {
    const onToggleLock = vi.fn()
    const options = createOptions({ onToggleLock })
    const event = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true })

    handleEditorKeydown(event, options)
    expect(onToggleLock).toHaveBeenCalledTimes(1)
  })

  it('triggers layer moves on Ctrl+] and Ctrl+[', () => {
    const onMoveLayer = vi.fn()
    const options = createOptions({ onMoveLayer })

    handleEditorKeydown(new KeyboardEvent('keydown', { key: ']', ctrlKey: true }), options)
    expect(onMoveLayer).toHaveBeenCalledWith(1)

    handleEditorKeydown(new KeyboardEvent('keydown', { key: '[', ctrlKey: true }), options)
    expect(onMoveLayer).toHaveBeenCalledWith(-1)
  })

  it('triggers select all on Ctrl+A and clear selection on Escape', () => {
    const onSelectAll = vi.fn()
    const onClearSelection = vi.fn()
    const options = createOptions({ onSelectAll, onClearSelection })

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }), options)
    expect(onSelectAll).toHaveBeenCalledTimes(1)

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'Escape' }), options)
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it('triggers undo on Ctrl+Z and redo on Ctrl+Shift+Z', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    const options = createOptions({ undo, redo })

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }), options)
    expect(undo).toHaveBeenCalledTimes(1)

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }), options)
    expect(redo).toHaveBeenCalledTimes(1)
  })

  it('triggers delete on Delete and Backspace keys', () => {
    const deleteSelected = vi.fn()
    const options = createOptions({ deleteSelected })

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'Delete' }), options)
    expect(deleteSelected).toHaveBeenCalledTimes(1)

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }), options)
    expect(deleteSelected).toHaveBeenCalledTimes(2)
  })

  it('nudges selected elements on arrow keys', () => {
    const updateElementsLive = vi.fn()
    const checkpoint = vi.fn()
    const options = createOptions({ updateElementsLive, checkpoint })

    handleEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }), options)
    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(updateElementsLive).toHaveBeenCalledTimes(1)
  })
})

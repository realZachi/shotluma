import { useEffect } from 'react'
import { getNudgeUpdates, type ElementUpdate } from './nudge'
import type { Slide } from '../types'

export type EditorKeyboardOptions = {
  activeSlide: Slide | undefined
  selectedElementIds: string[]
  checkpoint: () => void
  updateElementsLive: (slideId: string, updates: ElementUpdate[]) => void
  undo: () => void
  redo: () => void
  deleteSelected: () => void
  onDuplicate?: (() => void) | undefined
  onToggleLock?: (() => void) | undefined
  onMoveLayer?: ((direction: -1 | 1) => void) | undefined
  onSelectAll?: (() => void) | undefined
  onClearSelection?: (() => void) | undefined
  editorWidth?: number
  editorHeight?: number
}

const arrowKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement
  && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))

const getArrowDelta = (event: KeyboardEvent, editorWidth = 330, editorHeight = 330 * 2796 / 1290) => {
  const step = event.shiftKey ? 10 : 1
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
  return {
    x: dx / editorWidth * 100,
    y: dy / editorHeight * 100,
  }
}

function handleCommandShortcuts(
  event: KeyboardEvent,
  options: Pick<EditorKeyboardOptions, 'undo' | 'redo' | 'onDuplicate' | 'onToggleLock' | 'onSelectAll' | 'onMoveLayer'>,
): boolean {
  if (!event.metaKey && !event.ctrlKey) return false
  const key = event.key.toLowerCase()

  if (key === 'z') {
    event.preventDefault()
    if (event.shiftKey) options.redo()
    else options.undo()
    return true
  }
  if (key === 'd') {
    event.preventDefault()
    options.onDuplicate?.()
    return true
  }
  if (key === 'l') {
    event.preventDefault()
    options.onToggleLock?.()
    return true
  }
  if (key === 'a') {
    event.preventDefault()
    options.onSelectAll?.()
    return true
  }
  if (event.key === ']') {
    event.preventDefault()
    options.onMoveLayer?.(1)
    return true
  }
  if (event.key === '[') {
    event.preventDefault()
    options.onMoveLayer?.(-1)
    return true
  }
  return false
}

function handleSelectionShortcuts(
  event: KeyboardEvent,
  options: Pick<EditorKeyboardOptions, 'deleteSelected' | 'onClearSelection'>,
): boolean {
  if (event.key === 'Escape') {
    options.onClearSelection?.()
    return true
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    options.deleteSelected()
    return true
  }
  return false
}

export function handleEditorKeydown(event: KeyboardEvent, options: EditorKeyboardOptions): void {
  if (isTypingTarget(event.target)) return
  if (handleCommandShortcuts(event, options)) return
  if (handleSelectionShortcuts(event, options)) return
  if (options.selectedElementIds.length === 0 || !arrowKeys.includes(event.key)) return
  if (!options.activeSlide) return

  event.preventDefault()
  const updates = getNudgeUpdates(
    options.activeSlide.elements,
    options.selectedElementIds,
    getArrowDelta(event, options.editorWidth, options.editorHeight),
  )
  if (updates.length === 0) return
  if (!event.repeat) options.checkpoint()
  options.updateElementsLive(options.activeSlide.id, updates)
}

export function useEditorKeyboard(options: EditorKeyboardOptions) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => handleEditorKeydown(event, options)
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [options])
}

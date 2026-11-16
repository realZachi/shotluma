import { useRef, useState, type DragEvent } from 'react'
import { filterAcceptedImageFiles } from './ai-modal-image-files'

const hasDraggedFiles = (dataTransfer: DataTransfer | null) =>
  dataTransfer ? Array.from(dataTransfer.types).includes('Files') : false

/** Tracks drag depth and filters dropped files to supported PNG/JPEG/WebP images. */
export const useImageDropzone = <T extends HTMLElement = HTMLButtonElement>(
  onFiles: (files: File[]) => void,
) => {
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)

  const resetDragState = () => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }

  const onDragEnter = (event: DragEvent<T>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    if (hasDraggedFiles(event.dataTransfer)) {
      setIsDragging(true)
    }
  }

  const onDragLeave = (event: DragEvent<T>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) resetDragState()
  }

  const onDragOver = (event: DragEvent<T>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (event: DragEvent<T>) => {
    event.preventDefault()
    event.stopPropagation()
    resetDragState()
    const files = filterAcceptedImageFiles(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return {
    isDragging,
    dropzoneProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
  }
}

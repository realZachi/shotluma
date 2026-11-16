import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PropertiesPanel } from './Sidebar'
import { useImageDropzone } from './use-image-dropzone'
import type { Slide } from '../types'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const requireElement = (host: HTMLElement, selector: string) => {
  const element = host.querySelector(selector)
  if (!element) throw new Error(`Expected element matching ${selector}`)
  return element
}

const createSlide = (backgroundType: Slide['background']['type'] = 'solid'): Slide => ({
  id: 'slide-1',
  name: 'Screen 1',
  background: {
    type: backgroundType,
    color1: '#111116',
    color2: '#252435',
    angle: 135,
  },
  elements: [],
})

const createDragEvent = (
  type: string,
  options: { types?: string[]; files?: File[] } = {},
) => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: {
      types: string[]
      files: File[]
      dropEffect: string
    }
  }
  event.dataTransfer = {
    types: options.types ?? [],
    files: options.files ?? [],
    dropEffect: 'none',
  }
  return event
}

const DropzoneHarness = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
  const { isDragging, dropzoneProps } = useImageDropzone(onFiles)
  return (
    <button
      type="button"
      data-testid="dropzone"
      className={isDragging ? 'is-drag-active' : ''}
      {...dropzoneProps}
    >
      Drop here
    </button>
  )
}

describe('useImageDropzone', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  const renderNode = (node: React.ReactNode) => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root?.render(node)
    })
    return container
  }

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    container?.remove()
    container = null
    root = null
  })

  it('tracks nested drag enter/leave depth and ignores non-file drags', () => {
    const onFiles = vi.fn()
    const host = renderNode(<DropzoneHarness onFiles={onFiles} />)
    const button = requireElement(host, 'button')

    act(() => {
      button.dispatchEvent(createDragEvent('dragenter', { types: ['text/plain'] }))
    })
    expect(button.classList.contains('is-drag-active')).toBe(false)

    act(() => {
      button.dispatchEvent(createDragEvent('dragleave'))
      button.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))
      button.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))
    })
    expect(button.classList.contains('is-drag-active')).toBe(true)

    act(() => {
      button.dispatchEvent(createDragEvent('dragleave'))
    })
    expect(button.classList.contains('is-drag-active')).toBe(true)

    act(() => {
      button.dispatchEvent(createDragEvent('dragleave'))
    })
    expect(button.classList.contains('is-drag-active')).toBe(false)
  })

  it('filters dropped files to PNG, JPEG, and WebP images', () => {
    const onFiles = vi.fn()
    const host = renderNode(<DropzoneHarness onFiles={onFiles} />)
    const button = requireElement(host, 'button')
    const png = new File(['png'], 'shot.png', { type: 'image/png' })
    const webp = new File(['webp'], 'shot.webp', { type: 'image/webp' })
    const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' })

    act(() => {
      button.dispatchEvent(createDragEvent('drop', { files: [gif] }))
    })
    expect(onFiles).not.toHaveBeenCalled()

    act(() => {
      button.dispatchEvent(createDragEvent('drop', { files: [png, gif, webp] }))
    })
    expect(onFiles).toHaveBeenCalledTimes(1)
    expect(onFiles).toHaveBeenCalledWith([png, webp])
  })

  it('supports drag-and-drop in the sidebar uploads panel', () => {
    const onUploadFiles = vi.fn()
    const host = renderNode(
      <PropertiesPanel
        activeTool="uploads"
        activeSlide={createSlide()}
        uploads={[]}
        onApplyTemplate={() => undefined}
        onAddText={() => undefined}
        onAddDevice={() => undefined}
        onAddShape={() => undefined}
        onAddIcon={() => undefined}
        onUpdateBackground={() => undefined}
        onUploadFiles={onUploadFiles}
        onUploadBackground={() => undefined}
        onAddImage={() => undefined}
        onSetDeviceImage={() => undefined}
      />,
    )
    const uploadButton = requireElement(host, '.large-upload')
    const photo = new File(['img'], 'screen.jpg', { type: 'image/jpeg' })

    act(() => {
      uploadButton.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))
    })
    expect(uploadButton.classList.contains('is-drag-active')).toBe(true)

    act(() => {
      uploadButton.dispatchEvent(createDragEvent('drop', { files: [photo] }))
    })
    expect(uploadButton.classList.contains('is-drag-active')).toBe(false)
    expect(onUploadFiles).toHaveBeenCalledWith([photo])
  })

  it('supports drag-and-drop in the background image upload area', () => {
    const onUploadBackground = vi.fn()
    const host = renderNode(
      <PropertiesPanel
        activeTool="background"
        activeSlide={createSlide('image')}
        uploads={[]}
        onApplyTemplate={() => undefined}
        onAddText={() => undefined}
        onAddDevice={() => undefined}
        onAddShape={() => undefined}
        onAddIcon={() => undefined}
        onUpdateBackground={() => undefined}
        onUploadFiles={() => undefined}
        onUploadBackground={onUploadBackground}
        onAddImage={() => undefined}
        onSetDeviceImage={() => undefined}
      />,
    )
    const uploadButton = requireElement(host, '.upload-drop')
    const bg = new File(['bg'], 'wallpaper.png', { type: 'image/png' })

    act(() => {
      uploadButton.dispatchEvent(createDragEvent('dragenter', { types: ['Files'] }))
    })
    expect(uploadButton.classList.contains('is-drag-active')).toBe(true)

    act(() => {
      uploadButton.dispatchEvent(createDragEvent('drop', { files: [bg] }))
    })
    expect(uploadButton.classList.contains('is-drag-active')).toBe(false)
    expect(onUploadBackground).toHaveBeenCalledWith(bg)
  })
})

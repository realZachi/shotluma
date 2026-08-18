import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { makeTemplate } from '../data'
import { getDevicePlacement } from '../mockups/catalog'
import { fileToDataUrl, uid } from '../utils'
import { freshElementIds } from './element-utils'
import { panelRevealForAddedSlide, removeSlide } from './slide-operations'
import type {
  Background,
  CanvasElement,
  DeviceElement,
  ShapeElement,
  Slide,
  TemplateId,
  TextElement,
  TextPreset,
  ToolId,
  UploadAsset,
} from '../types'

type Commit = (updater: (current: Slide[]) => Slide[]) => void

type EditorActionsOptions = {
  slides: Slide[]
  activeSlide: Slide | undefined
  activeSlideId: string
  selectedElement: CanvasElement | undefined
  selectedElementId: string | null
  commit: Commit
  setActiveSlideId: Dispatch<SetStateAction<string>>
  setSelectedElementId: (id: string | null) => void
  setActiveTool: Dispatch<SetStateAction<ToolId>>
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>
  setUploads: Dispatch<SetStateAction<UploadAsset[]>>
  setToast: Dispatch<SetStateAction<string | null>>
}

const textPresets: Record<TextPreset, Partial<TextElement> & Pick<TextElement, 'text' | 'y' | 'fontSize' | 'fontWeight' | 'width' | 'lineHeight' | 'letterSpacing' | 'fontFamily'>> = {
  title: {
    text: 'Your headline',
    y: 10,
    fontSize: 42,
    fontWeight: 760,
    width: 82,
    lineHeight: 0.98,
    letterSpacing: -1.2,
    fontFamily: 'Bricolage Grotesque Variable',
  },
  subtitle: {
    text: 'A clear supporting line',
    y: 20,
    fontSize: 24,
    fontWeight: 650,
    width: 78,
    lineHeight: 1.05,
    letterSpacing: -0.5,
    fontFamily: 'Manrope Variable',
  },
  body: {
    text: 'A short explanation that captures your app’s value.',
    y: 24,
    fontSize: 17,
    fontWeight: 520,
    width: 76,
    lineHeight: 1.25,
    letterSpacing: -0.2,
    fontFamily: 'Instrument Sans Variable',
  },
  label: {
    text: 'NEUES FEATURE',
    y: 12,
    fontSize: 10,
    fontWeight: 760,
    width: 45,
    lineHeight: 1,
    letterSpacing: 1.4,
    fontFamily: 'Instrument Sans Variable',
    textTransform: 'uppercase',
    backgroundColor: '#d8ff55',
    backgroundOpacity: 1,
    padding: 6,
    borderRadius: 10,
    color: '#172015',
  },
  quote: {
    text: '“Less effort.\nMore impact.”',
    y: 20,
    fontSize: 27,
    fontWeight: 600,
    width: 80,
    lineHeight: 1.05,
    letterSpacing: -0.4,
    fontFamily: 'Playfair Display',
    italic: true,
  },
  stat: {
    text: '98%\nmore focus',
    y: 18,
    fontSize: 38,
    fontWeight: 760,
    width: 68,
    lineHeight: 0.92,
    letterSpacing: -1,
    fontFamily: 'Syne Variable',
  },
}

const createTextElement = (preset: TextPreset): TextElement => ({
  id: uid('text'),
  type: 'text',
  x: 9,
  rotation: 0,
  opacity: 1,
  color: '#ffffff',
  align: 'left',
  italic: false,
  underline: false,
  strikethrough: false,
  textTransform: 'none',
  backgroundColor: '#ffffff',
  backgroundOpacity: 0,
  padding: 0,
  borderRadius: 0,
  strokeColor: '#111116',
  strokeWidth: 0,
  shadow: 0,
  shadowColor: '#000000',
  ...textPresets[preset],
})

const createDeviceElement = (
  deviceStyle: DeviceElement['deviceStyle'],
  screenshot?: string,
): DeviceElement => ({
  id: uid('device'),
  type: 'device',
  ...getDevicePlacement(deviceStyle),
  opacity: 1,
  deviceStyle,
  screenTheme: 'coral',
  tiltX: 0,
  tiltY: 0,
  shadow: 55,
  ...(screenshot ? { screenshot } : {}),
})

export function useEditorActions({
  slides,
  activeSlide,
  activeSlideId,
  selectedElement,
  selectedElementId,
  commit,
  setActiveSlideId,
  setSelectedElementId,
  setActiveTool,
  setIsSidebarOpen,
  setUploads,
  setToast,
}: EditorActionsOptions) {
  // AI-authored HTML screens have no element or background layers; manual
  // edits would be invisible, so every mutation path rejects them with a hint.
  const rejectHtmlSlideEdit = useCallback(() => {
    if (activeSlide?.html === undefined) return false
    setToast('This screen was generated as HTML — edit it with AI')
    return true
  }, [activeSlide, setToast])

  const addElement = useCallback((element: CanvasElement, tool?: ToolId) => {
    if (rejectHtmlSlideEdit()) return
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? { ...slide, elements: [...slide.elements, element] }
      : slide))
    setSelectedElementId(element.id)
    if (tool) setActiveTool(tool)
  }, [activeSlideId, commit, rejectHtmlSlideEdit, setActiveTool, setSelectedElementId])

  const updateSelected = useCallback((patch: Partial<CanvasElement>) => {
    if (!selectedElementId) return
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? {
          ...slide,
          elements: slide.elements.map((element) => element.id === selectedElementId
            ? { ...element, ...patch } as CanvasElement
            : element),
        }
      : slide))
  }, [activeSlideId, commit, selectedElementId])

  const addText = useCallback((preset: TextPreset) => {
    addElement(createTextElement(preset), 'text')
  }, [addElement])

  const addShape = useCallback((shape: ShapeElement['shape']) => {
    const wideShape = ['pill', 'line', 'arrow', 'wave'].includes(shape)
    const width = shape === 'pill' ? 46 : wideShape ? 38 : 24
    addElement({
      id: uid('shape'),
      type: 'shape',
      x: 50 - width / 2,
      y: wideShape ? 38 : 34,
      width,
      rotation: 0,
      opacity: 1,
      shape,
      color: '#d8ff55',
      strokeColor: '#171713',
      strokeWidth: ['line', 'arrow', 'wave'].includes(shape) ? 6 : shape === 'ring' ? 4 : 0,
      shadow: 14,
    }, 'elements')
  }, [addElement])

  const addIcon = useCallback((iconId: string) => {
    const width = 12
    addElement({
      id: uid('icon'),
      type: 'icon',
      x: 50 - width / 2,
      y: 38,
      width,
      rotation: 0,
      opacity: 1,
      icon: iconId,
      color: '#ffffff',
      strokeWidth: 1.5,
      shadow: 0,
    }, 'icons')
  }, [addElement])

  const addDevice = useCallback((deviceStyle: DeviceElement['deviceStyle']) => {
    addElement(createDeviceElement(deviceStyle), 'device')
  }, [addElement])

  const addImage = useCallback((asset: UploadAsset) => {
    addElement({
      id: uid('image'),
      type: 'image',
      x: 15,
      y: 28,
      width: 70,
      rotation: 0,
      opacity: 1,
      src: asset.src,
      borderRadius: 0,
      shadow: 0,
    }, 'uploads')
  }, [addElement])

  const setDeviceImage = useCallback((asset: UploadAsset) => {
    const deviceTarget = selectedElement?.type === 'device'
      ? selectedElement
      : activeSlide?.elements.find((element) => element.type === 'device')
    if (!deviceTarget) {
      addElement(createDeviceElement('iphone-17-a', asset.src), 'device')
      return
    }

    setSelectedElementId(deviceTarget.id)
    setActiveTool('device')
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? {
          ...slide,
          elements: slide.elements.map((element) => element.id === deviceTarget.id
            ? { ...element, screenshot: asset.src }
            : element),
        }
      : slide))
  }, [activeSlide, activeSlideId, addElement, commit, selectedElement, setActiveTool, setSelectedElementId])

  const uploadFiles = useCallback(async (files: FileList) => {
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/'))
    const assets = await Promise.all(accepted.map(async (file) => ({
      id: uid('upload'),
      name: file.name,
      src: await fileToDataUrl(file),
    })))
    setUploads((current) => [...assets, ...current])
    if (assets.length > 0) {
      setToast(`${assets.length} ${assets.length === 1 ? 'file' : 'files'} added`)
    }
  }, [setToast, setUploads])

  const uploadToSelectedDevice = useCallback(async (file: File) => {
    const asset = { id: uid('upload'), name: file.name, src: await fileToDataUrl(file) }
    setUploads((current) => [asset, ...current])
    setDeviceImage(asset)
  }, [setDeviceImage, setUploads])

  const uploadBackgroundImage = useCallback(async (file: File) => {
    if (rejectHtmlSlideEdit()) return
    const asset = { id: uid('upload'), name: file.name, src: await fileToDataUrl(file) }
    setUploads((current) => [asset, ...current])
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? {
          ...slide,
          background: {
            ...slide.background,
            type: 'image',
            image: asset.src,
            imageFit: 'cover',
            imagePosition: 'center',
            overlayColor: '#111116',
            overlayOpacity: 0.18,
          },
        }
      : slide))
    setToast('Image set as background')
  }, [activeSlideId, commit, rejectHtmlSlideEdit, setToast, setUploads])

  const applyTemplate = useCallback((template: TemplateId) => {
    if (!activeSlide || rejectHtmlSlideEdit()) return
    const replacement = makeTemplate(template, activeSlide.name)
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? { ...replacement, id: activeSlideId }
      : slide))
    setSelectedElementId(null)
    setToast('Template applied')
  }, [activeSlide, activeSlideId, commit, rejectHtmlSlideEdit, setSelectedElementId, setToast])

  const duplicateSelected = useCallback(() => {
    if (!selectedElement) return
    addElement({
      ...selectedElement,
      id: uid(selectedElement.type),
      x: selectedElement.x + 3,
      y: selectedElement.y + 2,
    })
  }, [addElement, selectedElement])

  const toggleLock = useCallback(() => {
    if (selectedElement) updateSelected({ locked: !selectedElement.locked })
  }, [selectedElement, updateSelected])

  const moveSelectedLayer = useCallback((direction: -1 | 1) => {
    if (!selectedElementId) return
    commit((current) => current.map((slide) => {
      if (slide.id !== activeSlideId) return slide
      const index = slide.elements.findIndex((element) => element.id === selectedElementId)
      const targetIndex = index + direction
      const element = slide.elements[index]
      const target = slide.elements[targetIndex]
      if (!element || !target) return slide

      const elements = [...slide.elements]
      elements[index] = target
      elements[targetIndex] = element
      return { ...slide, elements }
    }))
  }, [activeSlideId, commit, selectedElementId])

  const addSlide = useCallback(() => {
    const slide: Slide = {
      id: uid('slide'),
      name: `Screen ${slides.length + 1}`,
      background: {
        type: 'solid',
        color1: '#f2eee5',
        color2: '#f2eee5',
        angle: 135,
      },
      elements: [],
    }
    const panelReveal = panelRevealForAddedSlide(slides.length)
    commit((current) => [...current, slide])
    setActiveSlideId(slide.id)
    setSelectedElementId(null)
    if (panelReveal) {
      setActiveTool(panelReveal.activeTool)
      setIsSidebarOpen(panelReveal.openSidebar)
    }
  }, [
    commit,
    setActiveSlideId,
    setActiveTool,
    setIsSidebarOpen,
    setSelectedElementId,
    slides.length,
  ])

  const duplicateSlide = useCallback((id: string) => {
    const sourceIndex = slides.findIndex((slide) => slide.id === id)
    const source = slides[sourceIndex]
    if (!source) return

    const copy: Slide = {
      ...source,
      id: uid('slide'),
      name: `${source.name} Copy`,
      elements: freshElementIds(source.elements),
    }
    commit((current) => [
      ...current.slice(0, sourceIndex + 1),
      copy,
      ...current.slice(sourceIndex + 1),
    ])
    setActiveSlideId(copy.id)
    setSelectedElementId(null)
  }, [commit, setActiveSlideId, setSelectedElementId, slides])

  const deleteSlide = useCallback((id: string) => {
    let nextActiveSlideId: string | null | undefined
    let nextSlideCount: number | undefined
    commit((current) => {
      const removal = removeSlide(current, id, activeSlideId)
      if (!removal) return current

      nextActiveSlideId = removal.activeSlideId
      nextSlideCount = removal.slides.length
      return removal.slides
    })
    if (nextActiveSlideId === undefined) return

    setActiveSlideId(nextActiveSlideId ?? '')
    setSelectedElementId(null)
    // Keep the panel closed after returning to the empty state so AI
    // generation does not inherit a previously open templates tab.
    if (nextSlideCount === 0) setIsSidebarOpen(false)
  }, [activeSlideId, commit, setActiveSlideId, setIsSidebarOpen, setSelectedElementId])

  const moveSlide = useCallback((id: string, direction: -1 | 1) => {
    commit((current) => {
      const index = current.findIndex((slide) => slide.id === id)
      const targetIndex = index + direction
      const slide = current[index]
      const target = current[targetIndex]
      if (!slide || !target) return current

      const next = [...current]
      next[index] = target
      next[targetIndex] = slide
      return next
    })
  }, [commit])

  const updateBackground = useCallback((patch: Partial<Background>) => {
    if (rejectHtmlSlideEdit()) return
    commit((current) => current.map((slide) => slide.id === activeSlideId
      ? { ...slide, background: { ...slide.background, ...patch } }
      : slide))
  }, [activeSlideId, commit, rejectHtmlSlideEdit])

  return {
    updateSelected,
    addText,
    addShape,
    addIcon,
    addDevice,
    addImage,
    setDeviceImage,
    uploadFiles,
    uploadToSelectedDevice,
    uploadBackgroundImage,
    applyTemplate,
    duplicateSelected,
    toggleLock,
    moveSelectedLayer,
    addSlide,
    duplicateSlide,
    deleteSlide,
    moveSlide,
    updateBackground,
  }
}

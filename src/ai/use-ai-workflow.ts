import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { importDataUrlAsset } from '../asset-store'
import { uid } from '../utils'
import { createAiController } from './controller'
import type { Slide, UploadAsset } from '../types'
import type { AiToolActivity } from './tools'

type AiWorkflowOptions = {
  slides: Slide[]
  setSlides: Dispatch<SetStateAction<Slide[]>>
  slidesRef: RefObject<Slide[]>
  setUploads: Dispatch<SetStateAction<UploadAsset[]>>
  uploadsRef: RefObject<UploadAsset[]>
  checkpoint: () => void
  setActiveSlideId: Dispatch<SetStateAction<string>>
  clearSelection: () => void
  setToast: Dispatch<SetStateAction<string | null>>
}

let stageScrollAnimation = 0

const animateStageScroll = (stage: HTMLElement, targetLeft: number) => {
  cancelAnimationFrame(stageScrollAnimation)
  const from = stage.scrollLeft
  const delta = targetLeft - from
  if (Math.abs(delta) < 1) return
  if (document.visibilityState === 'hidden') {
    stage.scrollLeft = targetLeft
    return
  }

  const duration = 550
  const start = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration)
    stage.scrollLeft = from + delta * (1 - Math.pow(1 - progress, 3))
    if (progress < 1) stageScrollAnimation = requestAnimationFrame(step)
  }
  stageScrollAnimation = requestAnimationFrame(step)
}

const scrollStageToArtboard = (slideId: string, attempt = 0) => {
  const node = document.getElementById(`artboard-${slideId}`)
  if (!node) {
    if (attempt < 10) {
      window.setTimeout(() => scrollStageToArtboard(slideId, attempt + 1), 32)
    }
    return
  }

  const stage = node.closest('.canvas-stage')
  if (!(stage instanceof HTMLElement)) return
  const nodeRect = node.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  const delta = nodeRect.left + nodeRect.width / 2
    - (stageRect.left + stageRect.width / 2)
  animateStageScroll(stage, stage.scrollLeft + delta)
}

export function useAiWorkflow({
  slides,
  setSlides,
  slidesRef,
  setUploads,
  uploadsRef,
  checkpoint,
  setActiveSlideId,
  clearSelection,
  setToast,
}: AiWorkflowOptions) {
  const [controller, setController] = useState<ReturnType<typeof createAiController> | null>(null)
  const [open, setOpen] = useState(false)
  const [targetSlideId, setTargetSlideId] = useState<string | null>(null)
  const [activity, setActivity] = useState<(AiToolActivity & { seq: number }) | null>(null)
  const activitySequence = useRef(0)
  const followedSlideId = useRef<string | null>(null)
  const preRunSlideIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    setController(createAiController({
      getSlides: () => slidesRef.current,
      setSlides: (updater) => {
        const next = updater(slidesRef.current)
        slidesRef.current = next
        setSlides(next)
      },
      getUploads: () => uploadsRef.current,
      setUploads: (updater) => {
        const next = updater(uploadsRef.current)
        uploadsRef.current = next
        setUploads(next)
      },
    }))
  }, [setSlides, setUploads, slidesRef, uploadsRef])

  const targetSlide = targetSlideId
    ? slides.find((slide) => slide.id === targetSlideId)
    : undefined

  const handleActivity = useCallback((nextActivity: AiToolActivity | null) => {
    if (!nextActivity) {
      setActivity(null)
      followedSlideId.current = null
      return
    }

    activitySequence.current += 1
    if (nextActivity.slideId && nextActivity.slideId !== followedSlideId.current) {
      followedSlideId.current = nextActivity.slideId
      scrollStageToArtboard(nextActivity.slideId)
    }
    setActivity((previous) => {
      const slideId = nextActivity.slideId ?? previous?.slideId
      return {
        tool: nextActivity.tool,
        ...(slideId ? { slideId } : {}),
        ...(nextActivity.elementId ? { elementId: nextActivity.elementId } : {}),
        x: nextActivity.x ?? previous?.x ?? 50,
        y: nextActivity.y ?? previous?.y ?? 30,
        seq: activitySequence.current,
      }
    })
  }, [])

  useEffect(() => {
    if (!activity) return
    const timer = window.setTimeout(() => setActivity(null), 6000)
    return () => window.clearTimeout(timer)
  }, [activity])

  const prepareRun = useCallback(async (files: { name: string; dataUrl: string }[]) => {
    checkpoint()
    clearSelection()
    preRunSlideIds.current = new Set(slidesRef.current.map((slide) => slide.id))
    const bySource = new Map(uploadsRef.current.map((asset) => [asset.src, asset]))
    const additions: UploadAsset[] = []
    const prepared: { assetId: string; name: string; dataUrl: string }[] = []
    for (const file of files) {
      // Uploads render from the stored Blob's object URL; the provider payload
      // keeps the original data URL because AI requests need base64 content.
      // Content-hashed storage makes re-attaching the same image dedupe here.
      const src = await importDataUrlAsset(file.dataUrl)
      let asset = bySource.get(src)
      if (!asset) {
        asset = { id: uid('upload'), name: file.name, src }
        additions.push(asset)
        bySource.set(asset.src, asset)
      }
      prepared.push({ assetId: asset.id, name: asset.name, dataUrl: file.dataUrl })
    }
    if (additions.length > 0) {
      uploadsRef.current = [...additions, ...uploadsRef.current]
      setUploads(uploadsRef.current)
    }
    return prepared
  }, [checkpoint, clearSelection, setUploads, slidesRef, uploadsRef])

  const openGenerator = useCallback(() => {
    setTargetSlideId(null)
    setOpen(true)
  }, [])

  const openEditor = useCallback((slideId: string) => {
    setActiveSlideId(slideId)
    clearSelection()
    setTargetSlideId(slideId)
    setOpen(true)
  }, [clearSelection, setActiveSlideId])

  const close = useCallback(() => {
    setOpen(false)
    setTargetSlideId(null)
  }, [])

  const handleFinished = useCallback((slidesCreated: number) => {
    setActivity(null)
    if (targetSlideId) {
      setToast('Screen edited with AI')
      setActiveSlideId(targetSlideId)
      clearSelection()
      return
    }

    setToast(`${slidesCreated} ${slidesCreated === 1 ? 'screen' : 'screens'} created with AI`)
    const firstNewSlide = slidesRef.current.find(
      (slide) => !preRunSlideIds.current.has(slide.id),
    )
    if (firstNewSlide) {
      setActiveSlideId(firstNewSlide.id)
      clearSelection()
    }
  }, [clearSelection, setActiveSlideId, setToast, slidesRef, targetSlideId])

  return {
    controller,
    open,
    targetSlide,
    activity,
    handleActivity,
    prepareRun,
    openGenerator,
    openEditor,
    close,
    handleFinished,
  }
}

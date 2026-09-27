import { getFontEmbedCSS, toBlob, toCanvas } from 'html-to-image'
import JSZip from 'jszip'
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { downloadBlob } from '../utils'
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportTarget,
} from './export-formats'
import { buildExportImageSources } from './export-image-payload'
import {
  getExportZipDownloadName,
  getExportZipEntryPath,
} from './export-paths'
import type { Slide } from '../types'

type SlideExportOptions = {
  slides: Slide[]
  projectName: string
  clearSelection: () => void
  setToast: Dispatch<SetStateAction<string | null>>
}

async function renderSlidePng(
  slide: Slide,
  format: ExportFormat,
  fontEmbedCSS: string | null,
) {
  const node = document.getElementById(`artboard-${slide.id}`)
  if (!node) return null

  const width = format.editorWidth
  const height = Math.round(format.editorWidth * format.height / format.width)

  const options = {
    pixelRatio: 1,
    width,
    height,
    canvasWidth: format.width,
    canvasHeight: format.height,
    backgroundColor: slide.background.color1,
    ...(fontEmbedCSS ? { fontEmbedCSS } : {}),
    filter: (candidate: HTMLElement) =>
      !(candidate instanceof HTMLElement && candidate.dataset['aiOverlay']),
  }

  // WebKit can rasterise a snapshot before the images nested inside it are
  // ready, dropping them from the first capture of an artboard. Rasterising
  // the same snapshot once without encoding a PNG primes it, so the capture
  // that is kept matches the editor.
  await toCanvas(node, options)
  return toBlob(node, options)
}

/**
 * Every artboard image paired with the size it covers once the artboard is
 * rasterised at `exportWidth`. Artboards are laid out at a fixed CSS width and
 * only scaled for zoom, so the ratio between the artboard's on-screen box and
 * the export width converts any child's box into export pixels — including the
 * device screens, whose perspective transform is already part of their box.
 */
const collectArtboardImages = (slides: Slide[], exportWidth: number) =>
  slides.flatMap((slide) => {
    const node = document.getElementById(`artboard-${slide.id}`)
    const artboard = node?.getBoundingClientRect()
    if (!node || !artboard || artboard.width <= 0) return []

    const exportScale = exportWidth / artboard.width
    return [...node.querySelectorAll('img')].map((image) => {
      const rect = image.getBoundingClientRect()
      return {
        image,
        footprint: {
          width: rect.width * exportScale,
          height: rect.height * exportScale,
        },
      }
    })
  })

/**
 * Swaps every image on the artboards for an export-sized re-encode and returns
 * the undo. React never rewrites a `src` prop it did not change, so the
 * substitution survives the progress updates the export loop performs.
 */
async function applyExportImageSources(slides: Slide[], exportWidth: number) {
  const placements = collectArtboardImages(slides, exportWidth)
  const sources = await buildExportImageSources(
    placements.map(({ image, footprint }) => ({ src: image.src, footprint })),
  )
  const restores: (() => void)[] = []

  for (const { image } of placements) {
    const exportSource = sources.get(image.src)
    if (!exportSource) continue
    const originalSource = image.src
    image.src = exportSource
    restores.push(() => {
      image.src = originalSource
    })
  }

  await Promise.all(
    placements.map(({ image }) => image.decode().catch(() => undefined)),
  )
  return () => {
    for (const restore of restores) restore()
  }
}

export function useSlideExport({
  slides,
  projectName,
  clearSelection,
  setToast,
}: SlideExportOptions) {
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const exportAll = useCallback(async (target: ExportTarget) => {
    if (exporting || slides.length === 0) return

    const formats = target === 'all' ? [...EXPORT_FORMATS] : [target]
    const nested = target === 'all'
    const total = slides.length * formats.length

    const exportWidth = Math.max(...formats.map((format) => format.width))

    setExporting(true)
    setExportProgress(0)
    clearSelection()
    let restoreImageSources: (() => void) | null = null
    try {
      await document.fonts.ready
      await new Promise((resolve) => window.setTimeout(resolve, 120))
      restoreImageSources = await applyExportImageSources(slides, exportWidth)
      const zip = new JSZip()
      const firstSlide = slides[0]
      const firstNode = firstSlide
        ? document.getElementById(`artboard-${firstSlide.id}`)
        : null
      const fontEmbedCSS = firstNode
        ? await getFontEmbedCSS(firstNode)
        : null

      let completed = 0
      for (const format of formats) {
        for (const [index, slide] of slides.entries()) {
          const blob = await renderSlidePng(slide, format, fontEmbedCSS)
          if (!blob) throw new Error(`Screen ${index + 1} couldn’t be rendered`)

          zip.file(
            getExportZipEntryPath(format.filename, index, slide.name, nested),
            blob,
          )
          completed += 1
          setExportProgress(Math.round((completed / total) * 100))
        }
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      const formatFilename = target === 'all' ? 'all-sizes' : target.filename
      downloadBlob(blob, getExportZipDownloadName(projectName, formatFilename))
      setToast(
        target === 'all'
          ? `Exported ${slides.length} PNGs in ${formats.length} size folders as a ZIP archive`
          : `Exported ${slides.length} PNGs for ${target.label} as a ZIP archive`,
      )
    } catch (error) {
      console.error(error)
      setToast('Export failed — please try again')
    } finally {
      restoreImageSources?.()
      setExporting(false)
      setExportProgress(0)
    }
  }, [clearSelection, exporting, projectName, setToast, slides])

  return { exporting, exportProgress, exportAll }
}

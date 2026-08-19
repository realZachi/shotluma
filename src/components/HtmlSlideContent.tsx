import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { resolveAssetReferences } from '../html-slide/assets'
import { deviceElementFromAttributes } from '../html-slide/device-attributes'
import { sanitizeScreenHtml } from '../html-slide/sanitize'
import { scopeSlideStyles } from '../html-slide/scope-styles'
import { DeviceMockup } from './CanvasElementView'
import type { DeviceElement, UploadAsset } from '../types'

type DeviceMount = {
  key: string
  node: HTMLElement
  element: DeviceElement
}

type Props = {
  html: string
  uploads: UploadAsset[]
}

/**
 * Renders an AI-authored HTML screen inside the artboard. The markup is
 * authored at the native 1290 × 2796 export size and scaled down to the
 * 330 px editor artboard, re-sanitized as defense in depth, and its
 * `<shotluma-device>` placeholders are hydrated with the real photo mockup
 * renderer through portals so licensed overlays and matrix3d perspective
 * stay identical to structured device elements.
 */
export const HtmlSlideContent = ({ html, uploads }: Props) => {
  const resolvedHtml = useMemo(() => {
    const { html: sanitized } = sanitizeScreenHtml(html)
    return resolveAssetReferences(
      sanitized,
      (assetId) => uploads.find((asset) => asset.id === assetId)?.src,
    )
  }, [html, uploads])

  const containerRef = useRef<HTMLDivElement>(null)
  const [mounts, setMounts] = useState<DeviceMount[]>([])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = resolvedHtml
    scopeSlideStyles(container)
    const nodes = Array.from(container.querySelectorAll<HTMLElement>('shotluma-device'))
    setMounts(nodes.map((node, index) => ({
      key: `device-${index}`,
      node,
      element: deviceElementFromAttributes({
        mockup: node.getAttribute('mockup'),
        screenshot: node.getAttribute('screenshot'),
        theme: node.getAttribute('theme'),
        shadow: node.getAttribute('shadow'),
      }, index),
    })))
  }, [resolvedHtml])

  return (
    <div className="html-slide-surface">
      <div ref={containerRef} className="html-slide-scale" />
      {mounts.map((mount) => createPortal(<DeviceMockup element={mount.element} />, mount.node, mount.key))}
    </div>
  )
}

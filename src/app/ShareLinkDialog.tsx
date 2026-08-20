import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Link01 } from '../components/icons'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Button } from '../components/ui/button'
import { createShareLink, SHARE_LINK_LENGTH_WARNING, type ShareLinkResult } from './share-link'
import { createSharePreviewImage } from './share-preview'
import type { Slide, UploadAsset } from '../types'

type ShareLinkDialogProps = {
  open: boolean
  projectName: string
  slides: Slide[]
  uploads: UploadAsset[]
  onOpenChange: (open: boolean) => void
}

// Share links can reach megabytes, so the dialog never renders the full URL —
// a short preview stands in and the copy button hands over the real thing.
const LINK_PREVIEW_LENGTH = 120

const formatLinkSize = (length: number) => (length >= 1024 * 1024
  ? `${(length / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(length / 1024))} KB`)

type ShareRequestKey = readonly [string, Slide[], UploadAsset[]]

// Everything shown by the dialog is keyed to the inputs that produced it, so
// a change to the project while the dialog is open (for example an AI run
// mutating slides) immediately renders as pending instead of surfacing the
// previous project's link or error.
type ShareState = {
  key: ShareRequestKey
  result: ShareLinkResult | null
  failed: boolean
  copied: boolean
  copyFailed: boolean
}

export function ShareLinkDialog({
  open,
  projectName,
  slides,
  uploads,
  onOpenChange,
}: ShareLinkDialogProps) {
  const [state, setState] = useState<ShareState | null>(null)
  const key = useMemo<ShareRequestKey>(
    () => [projectName, slides, uploads],
    [projectName, slides, uploads],
  )
  const active = state !== null && state.key === key ? state : null
  const link = active?.result ?? null
  const failed = active?.failed ?? false

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const [name, keyedSlides, keyedUploads] = key
    createShareLink({ projectName: name, slides: keyedSlides, uploads: keyedUploads }, {
      createPreview: () => createSharePreviewImage(name, keyedSlides),
    })
      .then((result) => {
        if (!cancelled) setState({ key, result, failed: false, copied: false, copyFailed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ key, result: null, failed: true, copied: false, copyFailed: false })
      })
    return () => {
      cancelled = true
    }
  }, [open, key])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setState(null)
    onOpenChange(nextOpen)
  }

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setState((current) => current && { ...current, copied: true, copyFailed: false })
    } catch {
      setState((current) => current && { ...current, copyFailed: true })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="share-link-dialog">
        <AlertDialogHeader>
          <AlertDialogMedia><Link01 size={17} /></AlertDialogMedia>
          <AlertDialogTitle>Share as link</AlertDialogTitle>
          <AlertDialogDescription>
            The link carries a full copy of “{projectName}”, images included.
            Whoever opens it gets their own local copy to edit or delete —
            without ever touching your project.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="share-link-dialog-body">
          {failed && <p className="share-link-dialog-error">The share link couldn’t be created.</p>}
          {!failed && !link && <p className="share-link-dialog-status">Preparing link …</p>}
          {link && (
            <>
              <div className="share-link-dialog-preview" aria-label="Share link preview">
                {link.url.length > LINK_PREVIEW_LENGTH ? `${link.url.slice(0, LINK_PREVIEW_LENGTH)}…` : link.url}
              </div>
              <p className="share-link-dialog-meta">
                {link.mode === 'short'
                  ? 'The shared copy is stored for 90 days; the project itself stays local.'
                  : `${formatLinkSize(link.url.length)} link — the share service couldn’t be reached, so this link carries the full project data.${
                    link.url.length > SHARE_LINK_LENGTH_WARNING
                      ? ' Some messengers truncate links this size.'
                      : ''}`}
              </p>
              {active?.copyFailed && (
                <>
                  <p className="share-link-dialog-error">
                    Copying was blocked by the browser — select the link below instead.
                  </p>
                  <input
                    className="share-link-dialog-fallback"
                    value={link.url}
                    readOnly
                    aria-label="Share link"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </>
              )}
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="share-link-dialog-close">Close</AlertDialogCancel>
          <Button
            type="button"
            className="share-link-dialog-copy"
            disabled={!link}
            onClick={() => void copyLink()}
          >
            {active?.copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

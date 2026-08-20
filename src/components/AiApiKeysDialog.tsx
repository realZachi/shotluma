import {
  useEffect,
  useId,
  useState,
  type SyntheticEvent,
} from 'react'
import {
  getAiProviderKeyFields,
  type AiProviderId,
} from '../ai/provider-catalog'
import {
  ENVIRONMENT_AI_PROVIDER_KEYS,
  getAiProviderAvailability,
  readStoredAiProviderKeys,
  writeStoredAiProviderKeys,
  type AiProviderKeys,
} from '../ai/provider-config'
import { ChevronDown, LockKeyhole } from './icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Input } from './ui/input'

export type AiApiKeysDialogProps = {
  open: boolean
  focusProviderId?: AiProviderId
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export const AiApiKeysDialog = ({
  open,
  focusProviderId,
  onOpenChange,
  onSaved,
}: AiApiKeysDialogProps) => {
  const formId = useId()
  // Remount via parent `key` when opening so draft always loads from storage.
  const [draft, setDraft] = useState<AiProviderKeys>(readStoredAiProviderKeys)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const targetId = focusProviderId
        ?? getAiProviderKeyFields()[0]?.providerIds[0]
      if (!targetId) return
      const field = getAiProviderKeyFields().find((entry) =>
        entry.providerIds.includes(targetId),
      )
      const node = document.getElementById(`${formId}-${field?.id ?? targetId}`)
      if (!(node instanceof HTMLInputElement)) return
      node.focus()
      node.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, focusProviderId, formId])

  const saveDraft = () => {
    const result = writeStoredAiProviderKeys(draft)
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    onSaved()
    onOpenChange(false)
  }

  const handleSave = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveDraft()
  }

  const envAvailability = getAiProviderAvailability(ENVIRONMENT_AI_PROVIDER_KEYS)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="ai-keys-dialog">
        <AlertDialogHeader>
          <AlertDialogMedia className="ai-keys-dialog-media">
            <LockKeyhole size={17} />
          </AlertDialogMedia>
          <AlertDialogTitle>API keys</AlertDialogTitle>
          <AlertDialogDescription>
            Manage the provider keys used for AI generation.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form
          className="ai-keys-dialog-form"
          onSubmit={handleSave}
        >
          <details className="ai-keys-dialog-disclosure">
            <summary>
              <span>How keys are stored</span>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <p>
              Keys are stored unencrypted in this browser. AI requests send a key only
              to the provider used for that request; Moonshot and OpenCode pass through
              a same-origin CORS proxy, and optional overlay assets use OpenAI. Use
              dedicated keys with strict limits.
            </p>
          </details>

          <div className="ai-keys-dialog-fields">
            {getAiProviderKeyFields().map((field) => {
              const inputId = `${formId}-${field.id}`
              const value = field.providerIds
                .map((providerId) => draft[providerId])
                .find((entry) => entry.length > 0) ?? ''
              const hasEnvFallback = field.providerIds.some((providerId) =>
                envAvailability[providerId] && !draft[providerId],
              )
              return (
                <label className="ai-keys-dialog-field" htmlFor={inputId} key={field.id}>
                  <span>{field.label}</span>
                  <Input
                    id={inputId}
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={hasEnvFallback ? 'Using .env.local' : 'Paste API key'}
                    value={value}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                      event.preventDefault()
                      saveDraft()
                    }}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setSaveError(null)
                      setDraft((current) => {
                        const next = { ...current }
                        for (const providerId of field.providerIds) {
                          next[providerId] = nextValue
                        }
                        return next
                      })
                    }}
                  />
                </label>
              )
            })}
          </div>

          {saveError && <p className="ai-keys-dialog-error" role="alert">{saveError}</p>}

          <AlertDialogFooter>
            <AlertDialogCancel className="ai-keys-dialog-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" className="ai-keys-dialog-save">
              Save keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

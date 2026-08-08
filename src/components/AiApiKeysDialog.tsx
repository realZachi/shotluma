import {
  useEffect,
  useId,
  useState,
  type SyntheticEvent,
} from 'react'
import {
  AI_PROVIDERS,
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
        ?? AI_PROVIDERS.find((provider) => provider.auth === 'apiKey')?.id
      if (!targetId) return
      const node = document.getElementById(`${formId}-${targetId}`)
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
              to the provider used for that request; Moonshot passes through the local proxy,
              and optional overlay assets use OpenAI. Use dedicated keys with strict limits.
            </p>
          </details>

          <div className="ai-keys-dialog-fields">
            {AI_PROVIDERS.filter((provider) => provider.auth === 'apiKey').map((provider) => {
              const inputId = `${formId}-${provider.id}`
              const hasEnvFallback = envAvailability[provider.id] && !draft[provider.id]
              return (
                <label className="ai-keys-dialog-field" htmlFor={inputId} key={provider.id}>
                  <span>{provider.label}</span>
                  <Input
                    id={inputId}
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={hasEnvFallback ? 'Using .env.local' : 'Paste API key'}
                    value={draft[provider.id]}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                      event.preventDefault()
                      saveDraft()
                    }}
                    onChange={(event) => {
                      const value = event.target.value
                      setSaveError(null)
                      setDraft((current) => ({ ...current, [provider.id]: value }))
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

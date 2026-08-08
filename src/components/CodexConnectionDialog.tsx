import { useState } from 'react'
import {
  buildCodexDesktopDeepLink,
  buildCodexSetupPrompt,
} from '../ai/codex-connection'
import { ChatGpt, Check, Copy, LockKeyhole } from './icons'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import type { CodexConnectionView } from '../ai/use-codex-connection'

export type CodexConnectionDialogProps = {
  open: boolean
  view: CodexConnectionView
  onOpenChange: (open: boolean) => void
  onCreateSetup: () => void
  onCheckConnection: () => void
  onDisconnect: () => void
}

const planLabel = (planType: string) => planType
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

export const CodexConnectionDialog = ({
  open,
  view,
  onOpenChange,
  onCreateSetup,
  onCheckConnection,
  onDisconnect,
}: CodexConnectionDialogProps) => {
  const [copiedPrompt, setCopiedPrompt] = useState('')
  const [copyError, setCopyError] = useState<string | null>(null)
  const prompt = view.connection ? buildCodexSetupPrompt(view.connection) : ''
  const desktopDeepLink = view.connection ? buildCodexDesktopDeepLink(view.connection) : ''
  const hasCopied = Boolean(prompt) && copiedPrompt === prompt

  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      setCopyError(null)
    } catch {
      setCopiedPrompt('')
      setCopyError('Your browser blocked clipboard access. Select and copy the prompt above manually.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="codex-connect-dialog">
        <AlertDialogHeader>
          <AlertDialogMedia className="codex-connect-dialog__media">
            <ChatGpt size={18} />
          </AlertDialogMedia>
          <AlertDialogTitle>Use your ChatGPT plan</AlertDialogTitle>
          <AlertDialogDescription>
            Connect ChatGPT or the Codex CLI once, then generate in Shotluma without an API key.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {view.status === 'connected'
          ? (
              <div className="codex-connect-success">
                <span className="codex-connect-success__icon"><Check size={16} /></span>
                <div>
                  <b>{`Connected · ChatGPT ${planLabel(view.account.planType)}`}</b>
                  {view.account.email && <span>{view.account.email}</span>}
                </div>
              </div>
            )
          : (
              <div className="codex-connect-setup">
                <ol className="codex-connect-steps">
                  <li><span>1</span><p><b>Open ChatGPT</b>Start a local Codex chat on this computer.</p></li>
                  <li><span>2</span><p><b>Send the setup prompt</b>It is filled in for you; press Send to run it.</p></li>
                  <li><span>3</span><p><b>Return here</b>Check the connection and start generating.</p></li>
                </ol>

                {!view.connection
                  ? (
                      <Button
                        type="button"
                        className="codex-connect-primary"
                        onClick={onCreateSetup}
                      >
                        Create setup prompt
                      </Button>
                    )
                  : (
                      <>
                        <div className="codex-connect-prompt">
                          <code>{prompt}</code>
                        </div>
                        <div className="codex-connect-actions">
                          <Button
                            type="button"
                            className="codex-connect-primary"
                            render={(
                              <a
                                href={desktopDeepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            )}
                          >
                            <ChatGpt size={15} />
                            Open in ChatGPT
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="codex-connect-secondary"
                            onClick={() => void copyPrompt()}
                          >
                            {hasCopied ? <Check size={15} /> : <Copy size={15} />}
                            {hasCopied ? 'Copied' : 'Copy prompt'}
                          </Button>
                        </div>
                        <p className="codex-connect-app-fallback">
                          ChatGPT didn’t open? Copy the prompt and paste it into Codex instead.
                        </p>
                        {copyError && (
                          <p className="codex-connect-message" role="status">{copyError}</p>
                        )}
                      </>
                    )}

                {view.message && (
                  <p className="codex-connect-message" role="status">{view.message}</p>
                )}
                <div className="codex-connect-privacy">
                  <LockKeyhole size={14} />
                  <span>The connector stays on this computer and never reads your ChatGPT tokens.</span>
                </div>
              </div>
            )}

        <AlertDialogFooter>
          {view.status === 'connected'
            ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="codex-connect-secondary"
                    onClick={onDisconnect}
                  >
                    Disconnect
                  </Button>
                  <AlertDialogCancel className="codex-connect-secondary">Done</AlertDialogCancel>
                </>
              )
            : (
                <>
                  <AlertDialogCancel className="codex-connect-secondary">Close</AlertDialogCancel>
                  {view.connection && (
                    <Button
                      type="button"
                      className="codex-connect-primary"
                      disabled={view.status === 'checking'}
                      onClick={onCheckConnection}
                    >
                      {view.status === 'checking' ? 'Checking…' : 'Check connection'}
                    </Button>
                  )}
                </>
              )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

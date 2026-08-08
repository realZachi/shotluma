import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CodexConnectionDialog } from './CodexConnectionDialog'
import type { ComponentProps, ReactNode } from 'react'

vi.mock('./ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: ReactNode; open: boolean }) => (
    open ? <div data-testid="alert-dialog">{children}</div> : null
  ),
  AlertDialogContent: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  AlertDialogMedia: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogCancel: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('./ui/button', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

const connection = {
  version: 1 as const,
  pairingToken: 'A'.repeat(43),
  appOrigin: 'https://app.shotluma.com',
}

const callbacks = {
  onOpenChange: () => undefined,
  onCreateSetup: () => undefined,
  onCheckConnection: () => undefined,
  onDisconnect: () => undefined,
}

describe('Codex connection dialog', () => {
  it('shows the hosted-user tutorial and copyable setup prompt', () => {
    const markup = renderToStaticMarkup(
      <CodexConnectionDialog
        open
        view={{
          status: 'offline',
          connection,
          account: null,
          message: 'Run the setup prompt in Codex, then check the connection.',
        }}
        {...callbacks}
      />,
    )

    expect(markup).toContain('Use your ChatGPT plan')
    expect(markup).toContain('Open in ChatGPT')
    expect(markup).toContain('Copy prompt')
    expect(markup).toContain('ChatGPT didn’t open?')
    expect(markup).toContain('https://app.shotluma.com/codex/shotluma-codex-bridge.mjs')
    expect(markup).toContain('Check connection')
    expect(markup).toContain('never reads your ChatGPT tokens')
    expect(markup).toContain('codex-connect-primary')
    expect(markup).toContain('codex-connect-secondary')
    expect(markup).not.toContain('Enter API key')
  })

  it('shows the verified ChatGPT plan after connecting', () => {
    const markup = renderToStaticMarkup(
      <CodexConnectionDialog
        open
        view={{
          status: 'connected',
          connection,
          account: {
            status: 'connected',
            email: 'user@example.com',
            planType: 'plus',
          },
          message: null,
        }}
        {...callbacks}
      />,
    )

    expect(markup).toContain('Connected · ChatGPT Plus')
    expect(markup).toContain('user@example.com')
    expect(markup).toContain('Disconnect')
    expect(markup).not.toContain('Open in ChatGPT')
  })
})

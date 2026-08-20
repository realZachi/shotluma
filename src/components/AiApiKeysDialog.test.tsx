import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AiApiKeysDialog } from './AiApiKeysDialog'
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
  AlertDialogAction: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('./ui/input', () => ({
  Input: (props: ComponentProps<'input'>) => <input {...props} />,
}))

describe('AI API keys dialog', () => {
  it('renders a password field for every provider when open', () => {
    const markup = renderToStaticMarkup(
      <AiApiKeysDialog
        open
        onOpenChange={() => undefined}
        onSaved={() => undefined}
      />,
    )

    expect(markup).toContain('API keys')
    expect(markup).toContain('How keys are stored')
    expect(markup).toContain('stored unencrypted in this browser')
    expect(markup).toContain('<details')
    expect(markup).toContain('<summary>')
    expect(markup).not.toContain('<details open=""')
    expect(markup).toContain('Moonshot')
    expect(markup).toContain('Google')
    expect(markup).toContain('Qwen')
    expect(markup).toContain('OpenAI')
    expect(markup).toContain('Anthropic')
    expect(markup).toContain('OpenRouter')
    expect(markup).toContain('OpenCode')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('<form')
    expect(markup).toContain('type="submit"')
    expect(markup).toContain('Save keys')
  })

  it('renders nothing when closed', () => {
    const markup = renderToStaticMarkup(
      <AiApiKeysDialog
        open={false}
        onOpenChange={() => undefined}
        onSaved={() => undefined}
      />,
    )

    expect(markup).toBe('')
  })
})

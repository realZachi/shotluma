import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader'
import type { ComponentProps, ReactNode } from 'react'

vi.mock('../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuShortcut: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  DropdownMenuTrigger: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('../components/ui/button', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}))

const headerProps = {
  projectName: 'Launch screens',
  lastSavedAt: 1_700_000_000_000,
  projects: [{
    id: 'project-1',
    projectName: 'Launch screens',
    createdAt: 1_700_000_000_000,
    savedAt: 1_700_000_000_000,
  }],
  currentProjectId: 'project-1',
  exporting: false,
  exportProgress: 0,
  exportDisabled: false,
  canUndo: false,
  canRedo: false,
  aiDisabled: false,
  onProjectNameChange: () => undefined,
  onOpenProject: () => undefined,
  onCreateProject: () => undefined,
  onDuplicateProject: () => undefined,
  onSaveProject: () => undefined,
  onRequestProjectDeletion: () => undefined,
  onUndo: () => undefined,
  onRedo: () => undefined,
  onOpenAi: () => undefined,
  onExport: () => undefined,
} satisfies Omit<ComponentProps<typeof AppHeader>, 'saveStatus' | 'persistenceReady'>

describe('App header', () => {
  it('exposes a new-project button beside the project menu', () => {
    const markup = renderToStaticMarkup(
      <AppHeader
        {...headerProps}
        saveStatus="saved"
        persistenceReady
      />,
    )

    expect(markup).toContain('class="project-switcher"')
    expect(markup).toContain('aria-label="Open project menu"')
    expect(markup).toContain('aria-label="New project"')
    expect(markup).toMatch(
      /aria-label="Open project menu"[\s\S]*aria-label="New project"/,
    )
    expect(markup).toContain('class="project-new-button"')
    expect(markup).not.toMatch(/aria-label="New project"[^>]*disabled/)
  })

  it('disables the new-project button until persistence is ready', () => {
    const markup = renderToStaticMarkup(
      <AppHeader
        {...headerProps}
        saveStatus="loading"
        persistenceReady={false}
      />,
    )

    expect(markup).toMatch(/aria-label="New project"[^>]*disabled/)
  })
})

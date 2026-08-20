import { APP_LOGO_URL, APP_NAME } from '../brand'
import {
  AiGenerative,
  AlertCircle,
  Check,
  ChevronDown,
  Cloud,
  Copy,
  Download,
  Link01,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from '../components/icons'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { EXPORT_FORMATS, type ExportTarget } from './export-formats'
import { saveStatusLabels, type SaveStatus } from './project-types'
import { formatProjectTime } from './project-utils'
import type { ProjectSummary } from '../persistence'

type AppHeaderProps = {
  projectName: string
  saveStatus: SaveStatus
  lastSavedAt: number | null
  projects: ProjectSummary[]
  currentProjectId: string
  persistenceReady: boolean
  exporting: boolean
  exportProgress: number
  exportDisabled: boolean
  canUndo: boolean
  canRedo: boolean
  aiDisabled: boolean
  onProjectNameChange: (name: string) => void
  onOpenProject: (projectId: string) => void
  onCreateProject: () => void
  onDuplicateProject: () => void
  onShareProject: () => void
  onSaveProject: () => void
  onRequestProjectDeletion: () => void
  onUndo: () => void
  onRedo: () => void
  onOpenAi: () => void
  onExport: (target: ExportTarget) => void
  children?: React.ReactNode
}

function ProjectMenu({
  projects,
  currentProjectId,
  disabled,
  onOpenProject,
  onCreateProject,
  onDuplicateProject,
  onShareProject,
  onSaveProject,
  onRequestProjectDeletion,
}: Pick<
  AppHeaderProps,
  | 'projects'
  | 'currentProjectId'
  | 'onOpenProject'
  | 'onCreateProject'
  | 'onDuplicateProject'
  | 'onShareProject'
  | 'onSaveProject'
  | 'onRequestProjectDeletion'
> & { disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="project-menu-trigger" aria-label="Open project menu">
        <ChevronDown size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={18} className="project-menu-content w-80">
        <DropdownMenuGroup className="project-menu-projects">
          <DropdownMenuLabel className="project-menu-label">
            <strong>Local projects</strong>
            <span>{projects.length} {projects.length === 1 ? 'project' : 'projects'} in this browser</span>
          </DropdownMenuLabel>
          <div className="project-menu-list">
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                className="project-menu-project"
                data-active={project.id === currentProjectId}
                disabled={disabled}
                onClick={() => onOpenProject(project.id)}
              >
                <span className="project-menu-check">
                  {project.id === currentProjectId && <Check size={14} />}
                </span>
                <span className="project-menu-project-copy">
                  <strong>{project.projectName}</strong>
                  <small>Saved {formatProjectTime(project.savedAt)}</small>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="project-menu-action" disabled={disabled} onClick={onCreateProject}>
            <Plus size={15} />
            <span>New project</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="project-menu-action" disabled={disabled} onClick={onDuplicateProject}>
            <Copy size={15} />
            <span>Duplicate project</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="project-menu-action" disabled={disabled} onClick={onShareProject}>
            <Link01 size={15} />
            <span>Share as link</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="project-menu-action" disabled={disabled} onClick={onSaveProject}>
          <Save size={15} />
          <span>Save now</span>
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="project-menu-action"
          variant="destructive"
          disabled={disabled || projects.length <= 1}
          onClick={onRequestProjectDeletion}
        >
          <Trash2 size={15} />
          <span>Delete current project</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExportMenu({
  exporting,
  exportProgress,
  exportDisabled,
  onExport,
}: Pick<AppHeaderProps, 'exporting' | 'exportProgress' | 'exportDisabled' | 'onExport'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="export-button"
        disabled={exporting || exportDisabled}
        aria-label="Choose export format"
      >
        {exporting
          ? <><span className="export-spinner" /><b>{exportProgress}%</b></>
          : <><Download size={17} /><b>Export</b><ChevronDown className="export-button-chevron" size={13} /></>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="export-menu-content w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="export-menu-label">
            <strong>Export all screens</strong>
            <span>Choose App Store format</span>
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="export-menu-item"
            onClick={() => onExport('all')}
          >
            <span className="export-menu-size">All</span>
            <span className="export-menu-copy">
              <strong>All sizes</strong>
              <small>ZIP with a folder per format</small>
            </span>
            <Download size={15} />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {EXPORT_FORMATS.map((format) => (
            <DropdownMenuItem
              key={format.id}
              className="export-menu-item"
              onClick={() => onExport(format)}
            >
              <span className="export-menu-size">{format.shortLabel}</span>
              <span className="export-menu-copy">
                <strong>{format.label}</strong>
                <small>{format.width} × {format.height} px</small>
              </span>
              <Download size={15} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppHeader({
  projectName,
  saveStatus,
  lastSavedAt,
  projects,
  currentProjectId,
  persistenceReady,
  exporting,
  exportProgress,
  exportDisabled,
  canUndo,
  canRedo,
  aiDisabled,
  onProjectNameChange,
  onOpenProject,
  onCreateProject,
  onDuplicateProject,
  onShareProject,
  onSaveProject,
  onRequestProjectDeletion,
  onUndo,
  onRedo,
  onOpenAi,
  onExport,
  children,
}: AppHeaderProps) {
  const projectMenuDisabled = !persistenceReady || saveStatus === 'saving'

  return (
    <header className="app-header">
      <div className="topbar">
        <a className="brand-lockup" href="https://shotluma.com" title="Open the Shotluma homepage">
          <span className="brand-symbol" aria-hidden="true">
            <img src={APP_LOGO_URL} alt="" width="30" height="30" />
          </span>
          <strong>{APP_NAME}</strong>
          <em>STUDIO</em>
        </a>
        <div className="project-meta">
          <span
            className={`save-state save-state--${saveStatus}`}
            title={lastSavedAt
              ? `Last saved at ${new Date(lastSavedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
              : undefined}
            aria-live="polite"
          >
            {saveStatus === 'error' ? <AlertCircle size={13} /> : <Cloud size={13} />}
            {saveStatusLabels[saveStatus]}
          </span>
          <div className="project-switcher">
            <div className="project-name-control">
              <input
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                aria-label="Project name"
              />
              <ProjectMenu
                projects={projects}
                currentProjectId={currentProjectId}
                disabled={projectMenuDisabled}
                onOpenProject={onOpenProject}
                onCreateProject={onCreateProject}
                onDuplicateProject={onDuplicateProject}
                onShareProject={onShareProject}
                onSaveProject={onSaveProject}
                onRequestProjectDeletion={onRequestProjectDeletion}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="project-new-button"
              aria-label="New project"
              title="New project"
              disabled={projectMenuDisabled}
              onClick={onCreateProject}
            >
              <Plus size={13} />
            </Button>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="history-actions">
            <button onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
              <Undo2 size={17} />
            </button>
            <button onClick={onRedo} disabled={!canRedo} title="Redo (⇧⌘Z)">
              <Redo2 size={17} />
            </button>
          </div>
          <Button
            className="ai-generate-button"
            variant="secondary"
            size="default"
            onClick={onOpenAi}
            disabled={aiDisabled}
          >
            <span className="ai-generate-button-mark" aria-hidden="true"><AiGenerative size={14} /></span>
            <span>Generate with AI</span>
          </Button>
          <ExportMenu
            exporting={exporting}
            exportProgress={exportProgress}
            exportDisabled={exportDisabled}
            onExport={onExport}
          />
        </div>
      </div>
      {children}
    </header>
  )
}

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
  MonitorSmartphone,
  Plus,
  Redo2,
  Save,
  SmartPhone01,
  Tablet01,
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
import { EXPORT_FORMATS, getScreenFormat, type ExportTarget } from './export-formats'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getLocaleDefinition } from './locale-types'
import { saveStatusLabels, type SaveStatus } from './project-types'
import { formatProjectTime } from './project-utils'
import type { ProjectSummary } from '../persistence'

type AppHeaderProps = {
  projectName: string
  canvasFormatId: string
  onSelectCanvasFormat: (formatId: string) => void
  activeLocale?: string
  onSelectLocale?: (locale: string) => void
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
  /** True while an AI generation is running; project deletion is held back until it ends. */
  aiRunActive: boolean
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
  onOpenStorePreview?: () => void
  onExport: (target: ExportTarget) => void
  children?: React.ReactNode
}

function ProjectMenu({
  projects,
  currentProjectId,
  disabled,
  aiRunActive,
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
  | 'aiRunActive'
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
          disabled={disabled || projects.length <= 1 || aiRunActive}
          onClick={onRequestProjectDeletion}
        >
          <Trash2 size={15} />
          <span>{aiRunActive ? 'Delete waits for the AI run' : 'Delete current project'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ScreenFormatMenu({
  canvasFormatId,
  onSelectCanvasFormat,
}: {
  canvasFormatId: string
  onSelectCanvasFormat: (formatId: string) => void
}) {
  const current = getScreenFormat(canvasFormatId)
  const isTablet = current.category === 'ipad' || current.id.includes('tablet')
  const Icon = isTablet ? Tablet01 : SmartPhone01

  const iphones = EXPORT_FORMATS.filter((f) => f.category === 'iphone')
  const ipads = EXPORT_FORMATS.filter((f) => f.category === 'ipad')
  const androids = EXPORT_FORMATS.filter((f) => f.category === 'android')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="screen-format-control"
        aria-label={`Current screen format: ${current.label}. Click to change.`}
      >
        <Icon size={14} />
        <span>{current.shortLabel}</span>
        <ChevronDown className="screen-format-chevron" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={18} className="screen-format-menu-content">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="project-menu-label">
            <strong>iPhone displays</strong>
            <span>Apple App Store</span>
          </DropdownMenuLabel>
          {iphones.map((format) => {
            const isSelected = format.id === current.id
            return (
              <DropdownMenuItem
                key={format.id}
                className="screen-format-item"
                data-active={isSelected}
                onClick={() => onSelectCanvasFormat(format.id)}
              >
                <span className="screen-format-item-check">
                  {isSelected && <Check size={14} />}
                </span>
                <span className="screen-format-item-copy">
                  <strong>{format.label}</strong>
                  <small>{format.width} × {format.height} px</small>
                </span>
                <span className="screen-format-badge">iOS</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="project-menu-label">
            <strong>iPad displays</strong>
            <span>Pro & Air (Portrait & Landscape)</span>
          </DropdownMenuLabel>
          {ipads.map((format) => {
            const isSelected = format.id === current.id
            return (
              <DropdownMenuItem
                key={format.id}
                className="screen-format-item"
                data-active={isSelected}
                onClick={() => onSelectCanvasFormat(format.id)}
              >
                <span className="screen-format-item-check">
                  {isSelected && <Check size={14} />}
                </span>
                <span className="screen-format-item-copy">
                  <strong>{format.label}</strong>
                  <small>{format.width} × {format.height} px · {format.orientation}</small>
                </span>
                <span className="screen-format-badge">iPadOS</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="project-menu-label">
            <strong>Android Phone & Tablets</strong>
            <span>Google Play Store</span>
          </DropdownMenuLabel>
          {androids.map((format) => {
            const isSelected = format.id === current.id
            return (
              <DropdownMenuItem
                key={format.id}
                className="screen-format-item"
                data-active={isSelected}
                onClick={() => onSelectCanvasFormat(format.id)}
              >
                <span className="screen-format-item-check">
                  {isSelected && <Check size={14} />}
                </span>
                <span className="screen-format-item-copy">
                  <strong>{format.label}</strong>
                  <small>{format.width} × {format.height} px · {format.orientation}</small>
                </span>
                <span className="screen-format-badge">Play Store</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LocaleMenu({
  activeLocale = DEFAULT_LOCALE,
  onSelectLocale,
}: {
  activeLocale?: string | undefined
  onSelectLocale?: ((locale: string) => void) | undefined
}) {
  const current = getLocaleDefinition(activeLocale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="screen-format-trigger"
        aria-label="Select active language"
        title="Active language for screenshot text"
      >
        <span style={{ fontSize: '13px' }}>{current.flag}</span>
        <strong>{current.code}</strong>
        <ChevronDown size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={14} className="screen-format-menu-content w-64 max-h-[420px] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="project-menu-label">
            <strong>Active Language</strong>
            <span>Translate text per country / region</span>
          </DropdownMenuLabel>
          {SUPPORTED_LOCALES.map((locale) => {
            const isSelected = locale.code === current.code
            return (
              <DropdownMenuItem
                key={locale.code}
                className="screen-format-item"
                data-active={isSelected}
                onClick={() => onSelectLocale?.(locale.code)}
              >
                <span className="screen-format-item-check">
                  {isSelected && <Check size={14} />}
                </span>
                <span style={{ fontSize: '14px', marginRight: '6px' }}>{locale.flag}</span>
                <span className="screen-format-item-copy">
                  <strong>{locale.label}</strong>
                  <small>{locale.nativeLabel} · {locale.code}</small>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExportMenu({
  canvasFormatId,
  exporting,
  exportProgress,
  exportDisabled,
  onExport,
}: Pick<AppHeaderProps, 'canvasFormatId' | 'exporting' | 'exportProgress' | 'exportDisabled' | 'onExport'>) {
  const currentFormat = getScreenFormat(canvasFormatId)
  const iphones = EXPORT_FORMATS.filter((f) => f.category === 'iphone')
  const ipads = EXPORT_FORMATS.filter((f) => f.category === 'ipad')
  const androids = EXPORT_FORMATS.filter((f) => f.category === 'android')

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
      <DropdownMenuContent align="end" sideOffset={6} className="export-menu-content w-72 max-h-[500px] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="export-menu-label">
            <strong>Quick export</strong>
            <span>Active project screen size</span>
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="export-menu-item"
            onClick={() => onExport(currentFormat)}
          >
            <span className="export-menu-size">{currentFormat.shortLabel}</span>
            <span className="export-menu-copy">
              <strong>{currentFormat.label}</strong>
              <small>{currentFormat.width} × {currentFormat.height} px (Current)</small>
            </span>
            <Download size={15} />
          </DropdownMenuItem>
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
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="export-menu-label">
            <strong>iPhone</strong>
            <span>Apple App Store</span>
          </DropdownMenuLabel>
          {iphones.map((format) => (
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
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="export-menu-label">
            <strong>iPad</strong>
            <span>Apple App Store</span>
          </DropdownMenuLabel>
          {ipads.map((format) => (
            <DropdownMenuItem
              key={format.id}
              className="export-menu-item"
              onClick={() => onExport(format)}
            >
              <span className="export-menu-size">{format.shortLabel}</span>
              <span className="export-menu-copy">
                <strong>{format.label}</strong>
                <small>{format.width} × {format.height} px · {format.orientation}</small>
              </span>
              <Download size={15} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="export-menu-label">
            <strong>Android</strong>
            <span>Google Play Store</span>
          </DropdownMenuLabel>
          {androids.map((format) => (
            <DropdownMenuItem
              key={format.id}
              className="export-menu-item"
              onClick={() => onExport(format)}
            >
              <span className="export-menu-size">{format.shortLabel}</span>
              <span className="export-menu-copy">
                <strong>{format.label}</strong>
                <small>{format.width} × {format.height} px · {format.orientation}</small>
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
  canvasFormatId,
  onSelectCanvasFormat,
  activeLocale,
  onSelectLocale,
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
  aiRunActive,
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
  onOpenStorePreview,
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
                aiRunActive={aiRunActive}
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
          <ScreenFormatMenu
            canvasFormatId={canvasFormatId}
            onSelectCanvasFormat={onSelectCanvasFormat}
          />
          <LocaleMenu
            activeLocale={activeLocale}
            onSelectLocale={onSelectLocale}
          />
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
          {onOpenStorePreview && (
            <Button
              variant="outline"
              size="default"
              onClick={onOpenStorePreview}
              title="Preview in App Store & Google Play"
              aria-label="Preview in App Store & Google Play"
            >
              <MonitorSmartphone size={14} />
              <span>Store Preview</span>
            </Button>
          )}
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
            canvasFormatId={canvasFormatId}
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

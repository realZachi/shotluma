import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { hydrateProjectAssets } from '../asset-store'
import { createInitialSlides } from '../data'
import {
  deleteProject,
  loadProject,
  loadProjectWorkspace,
  removeLegacyProject,
  saveProject,
  saveProjectIfCurrent,
  setActiveProjectId,
  type PersistedProject,
  type ProjectSummary,
} from '../persistence'
import { uid } from '../utils'
import {
  consumeInterruptedGeneration,
  DEFAULT_PROJECT_NAME,
  getUniqueProjectName,
  resolveGeneratedProjectName,
  upsertProjectSummary,
} from './project-utils'
import { consumeShareLinkHash, decodeSharePayload } from './share-link'
import type { Slide, UploadAsset } from '../types'
import type { SaveStatus } from './project-types'

type ProjectWorkspaceOptions = {
  initialProjectName: string
  slides: Slide[]
  setSlides: Dispatch<SetStateAction<Slide[]>>
  slidesRef: RefObject<Slide[]>
  uploads: UploadAsset[]
  setUploads: Dispatch<SetStateAction<UploadAsset[]>>
  uploadsRef: RefObject<UploadAsset[]>
  onProjectReplaced: (project: PersistedProject) => void
  setToast: Dispatch<SetStateAction<string | null>>
  /**
   * True while an AI generation is running. Saves made during a run carry the
   * interrupted-generation marker, so a project closed mid-run can explain the
   * half-finished screens on its next load.
   */
  isAiRunActive: () => boolean
}

const INTERRUPTED_GENERATION_MESSAGE =
  'The last AI generation was interrupted — finished screens were kept'
const STALE_SAVE_CONFLICT_MESSAGE =
  'This project changed in another tab — the newer version was loaded here'

const makeNewProject = (
  projectName: string,
  slides: Slide[],
  uploads: UploadAsset[],
): PersistedProject => {
  const now = Date.now()
  return {
    id: uid('project'),
    projectName,
    slides,
    uploads,
    createdAt: now,
    savedAt: now,
  }
}

type SharedImportResult =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'imported'; project: PersistedProject }

/**
 * Imports a project carried by a `#share=` link as a new, independent local
 * copy: inlined images become locally stored blobs on save, so later edits or
 * deletion only ever touch this browser's copy.
 */
const importSharedProject = async (existingProjects: ProjectSummary[]): Promise<SharedImportResult> => {
  const sharedHash = consumeShareLinkHash()
  if (!sharedHash) return { status: 'none' }
  sharedImportPending = true
  try {
    const shared = await decodeSharePayload(sharedHash)
    if (!shared) return { status: 'invalid' }
    const project = await hydrateProjectAssets(makeNewProject(
      getUniqueProjectName(existingProjects, shared.projectName),
      shared.slides,
      shared.uploads,
    ))
    await saveProject(project)
    return { status: 'imported', project }
  } catch {
    return { status: 'invalid' }
  }
}

// React StrictMode double-invokes the hydration effect in development. The
// first run consumes the one-shot URL fragment and may be cancelled mid-way,
// so both runs must share a single import request — otherwise the shared
// project is either lost or saved twice.
let sharedImportRequest: Promise<SharedImportResult> | null = null
let sharedImportPending = false

const importSharedProjectOnce = (existingProjects: ProjectSummary[]): Promise<SharedImportResult> => {
  sharedImportRequest ??= importSharedProject(existingProjects)
  return sharedImportRequest
}

/**
 * Marks the import as fully handled. Later effect runs (dependency identity
 * changes) then resolve to 'none' instead of re-applying the imported project
 * or re-showing its toast.
 */
const settleSharedImport = () => {
  sharedImportPending = false
  sharedImportRequest = Promise.resolve({ status: 'none' })
}

export function useProjectWorkspace({
  initialProjectName,
  slides,
  setSlides,
  slidesRef,
  uploads,
  setUploads,
  uploadsRef,
  onProjectReplaced,
  setToast,
  isAiRunActive,
}: ProjectWorkspaceOptions) {
  const [projectName, setProjectNameState] = useState(initialProjectName)
  const projectNameRef = useRef(initialProjectName)
  const [currentProjectId, setCurrentProjectId] = useState('current')
  const currentProjectIdRef = useRef('current')
  const currentProjectCreatedAtRef = useRef(0)
  // The `savedAt` this tab last loaded or wrote for the current project. A
  // save only succeeds when the stored record still carries this value —
  // otherwise another tab (or another load) has since saved a newer version
  // and this tab's in-memory slides/uploads are stale.
  const knownSavedAtRef = useRef<number | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [persistenceReady, setPersistenceReady] = useState(false)
  const persistenceReadyRef = useRef(false)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const changeRevisionRef = useRef(0)
  const saveAttemptRef = useRef(0)
  const skipNextAutoSaveRef = useRef(false)
  const projectTransitionRef = useRef(false)

  useEffect(() => {
    slidesRef.current = slides
  }, [slides, slidesRef])

  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads, uploadsRef])

  const setProjectName = useCallback((name: string) => {
    projectNameRef.current = name
    setProjectNameState(name)
  }, [])

  const replaceProject = useCallback((project: PersistedProject) => {
    currentProjectIdRef.current = project.id
    currentProjectCreatedAtRef.current = project.createdAt
    knownSavedAtRef.current = project.savedAt
    projectNameRef.current = project.projectName
    slidesRef.current = project.slides
    uploadsRef.current = project.uploads
    setCurrentProjectId(project.id)
    setProjectNameState(project.projectName)
    setSlides(project.slides)
    setUploads(project.uploads)
    setLastSavedAt(project.savedAt)
    onProjectReplaced(project)
  }, [onProjectReplaced, setSlides, setUploads, slidesRef, uploadsRef])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    const hydrateProject = async () => {
      try {
        const workspace = await loadProjectWorkspace()
        if (isCancelled()) return

        const sharedImport = await importSharedProjectOnce(workspace.projects)
        const imported = sharedImport.status === 'imported' ? sharedImport.project : null
        let project = imported ?? workspace.activeProject ?? makeNewProject(
          projectNameRef.current,
          slidesRef.current,
          uploadsRef.current,
        )
        if (!imported && !workspace.activeProject) await saveProject(project)
        const interrupted = consumeInterruptedGeneration(project)
        if (interrupted) {
          project = interrupted
          await saveProject(project)
        }
        await setActiveProjectId(project.id)
        if (isCancelled()) return

        replaceProject(project)
        setProjects(imported || workspace.activeProject
          ? upsertProjectSummary(workspace.projects, project)
          : upsertProjectSummary([], project))
        if (sharedImport.status === 'imported') {
          setToast('Shared project imported as your own local copy')
        } else if (sharedImport.status === 'invalid') {
          setToast('Couldn’t open the shared project link')
        } else if (interrupted) {
          setToast(INTERRUPTED_GENERATION_MESSAGE)
        }
        if (sharedImport.status !== 'none') settleSharedImport()
        removeLegacyProject()
        skipNextAutoSaveRef.current = true
        setSaveStatus('saved')
      } catch {
        if (!isCancelled()) {
          // The share fragment is already consumed, so a hydration failure
          // must still tell the user their shared link went nowhere.
          if (sharedImportPending) {
            settleSharedImport()
            setToast('Couldn’t open the shared project link')
          }
          setSaveStatus('error')
        }
      } finally {
        if (!isCancelled()) {
          persistenceReadyRef.current = true
          setPersistenceReady(true)
        }
      }
    }

    void hydrateProject()
    return () => {
      cancelled = true
    }
  }, [replaceProject, setToast, slidesRef, uploadsRef])

  const saveCurrentProject = useCallback(async (showConfirmation = false) => {
    if (!persistenceReadyRef.current || projectTransitionRef.current) return false

    const savedAt = Date.now()
    const revision = changeRevisionRef.current
    const attempt = ++saveAttemptRef.current
    const expectedSavedAt = knownSavedAtRef.current
    const snapshot: PersistedProject = {
      id: currentProjectIdRef.current,
      projectName: projectNameRef.current.trim() || DEFAULT_PROJECT_NAME,
      slides: slidesRef.current,
      uploads: uploadsRef.current,
      createdAt: currentProjectCreatedAtRef.current,
      savedAt,
      ...(isAiRunActive() ? { interruptedGeneration: true as const } : {}),
    }

    setSaveStatus('saving')
    const saveRequest = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProjectIfCurrent(snapshot, expectedSavedAt))
    saveQueueRef.current = saveRequest.then(
      () => undefined,
      () => undefined,
    )

    try {
      const outcome = await saveRequest
      removeLegacyProject()

      if (outcome.status === 'conflict') {
        // Another tab saved a newer version of this exact project while this
        // tab's save was in flight. Adopt that newer canvas instead of
        // silently overwriting it with this tab's stale slides/uploads, and
        // tell the user plainly rather than losing the conflict silently.
        const fresher = await hydrateProjectAssets(outcome.current)
        skipNextAutoSaveRef.current = true
        replaceProject(fresher)
        setProjects((current) => upsertProjectSummary(current, fresher))
        setSaveStatus('conflict')
        setToast(STALE_SAVE_CONFLICT_MESSAGE)
        return false
      }

      if (attempt === saveAttemptRef.current && revision === changeRevisionRef.current) {
        setSaveStatus('saved')
        setLastSavedAt(savedAt)
      }
      knownSavedAtRef.current = savedAt
      setProjects((current) => upsertProjectSummary(current, snapshot))
      if (showConfirmation) setToast('Project saved locally')
      return true
    } catch {
      if (attempt === saveAttemptRef.current && revision === changeRevisionRef.current) {
        setSaveStatus('error')
      }
      if (showConfirmation) setToast('Couldn’t save locally')
      return false
    }
  }, [isAiRunActive, replaceProject, setToast, slidesRef, uploadsRef])

  const runProjectTransition = useCallback(async (
    operation: () => Promise<PersistedProject>,
    successMessage: string,
    errorMessage: string,
  ) => {
    if (projectTransitionRef.current) return
    const saved = await saveCurrentProject()
    if (!saved) {
      setToast(errorMessage)
      return
    }

    projectTransitionRef.current = true
    try {
      let project = await operation()
      const interrupted = consumeInterruptedGeneration(project)
      if (interrupted) {
        project = interrupted
        await saveProject(project)
      }
      await setActiveProjectId(project.id)
      skipNextAutoSaveRef.current = true
      replaceProject(project)
      setProjects((current) => upsertProjectSummary(current, project))
      setSaveStatus('saved')
      setToast(interrupted ? INTERRUPTED_GENERATION_MESSAGE : successMessage)
    } catch {
      setSaveStatus('error')
      setToast(errorMessage)
    } finally {
      projectTransitionRef.current = false
    }
  }, [replaceProject, saveCurrentProject, setToast])

  const openProject = useCallback((projectId: string) => {
    if (projectId === currentProjectIdRef.current) return
    void runProjectTransition(async () => {
      const project = await loadProject(projectId)
      if (!project) throw new Error('Project not found')
      return project
    }, 'Project opened', 'Couldn’t open project')
  }, [runProjectTransition])

  const createNewProject = useCallback(() => {
    const project = makeNewProject(
      getUniqueProjectName(projects, 'New Project'),
      createInitialSlides(),
      [],
    )
    void runProjectTransition(async () => {
      await saveProject(project)
      return project
    }, 'New project created', 'Couldn’t create project')
  }, [projects, runProjectTransition])

  const applyGeneratedProjectName = useCallback((appName: string) => {
    const nextName = resolveGeneratedProjectName(
      projects,
      currentProjectIdRef.current,
      projectNameRef.current,
      appName,
    )
    if (nextName) setProjectName(nextName)
  }, [projects, setProjectName])

  const duplicateCurrentProject = useCallback(() => {
    const project = makeNewProject(
      getUniqueProjectName(
        projects,
        `${projectNameRef.current.trim() || DEFAULT_PROJECT_NAME} Copy`,
      ),
      structuredClone(slidesRef.current),
      structuredClone(uploadsRef.current),
    )
    void runProjectTransition(async () => {
      await saveProject(project)
      return project
    }, 'Project duplicated', 'Couldn’t duplicate project')
  }, [projects, runProjectTransition, slidesRef, uploadsRef])

  const deleteCurrentProject = useCallback(async () => {
    if (projects.length <= 1 || projectTransitionRef.current) return

    projectTransitionRef.current = true
    setDeletingProject(true)
    try {
      await saveQueueRef.current.catch(() => undefined)
      const nextSummary = projects.find((project) => project.id !== currentProjectIdRef.current)
      if (!nextSummary) throw new Error('No replacement project found')
      const nextProject = await loadProject(nextSummary.id)
      if (!nextProject) throw new Error('Replacement project not found')

      await deleteProject(currentProjectIdRef.current)
      await setActiveProjectId(nextProject.id)
      skipNextAutoSaveRef.current = true
      replaceProject(nextProject)
      setProjects((current) => current.filter((project) => project.id !== currentProjectIdRef.current))
      setSaveStatus('saved')
      setDeleteDialogOpen(false)
      setToast('Project deleted locally')
    } catch {
      setSaveStatus('error')
      setToast('Couldn’t delete project')
    } finally {
      projectTransitionRef.current = false
      setDeletingProject(false)
    }
  }, [projects, replaceProject, setToast])

  useEffect(() => {
    if (!persistenceReady) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }

    changeRevisionRef.current += 1
    setSaveStatus('dirty')
    const timer = window.setTimeout(() => {
      void saveCurrentProject()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [persistenceReady, projectName, saveCurrentProject, slides, uploads])

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void saveCurrentProject(true)
    }

    const flushPendingChanges = () => {
      if (document.visibilityState === 'hidden') void saveCurrentProject()
    }

    window.addEventListener('keydown', handleSaveShortcut)
    document.addEventListener('visibilitychange', flushPendingChanges)
    window.addEventListener('pagehide', flushPendingChanges)
    return () => {
      window.removeEventListener('keydown', handleSaveShortcut)
      document.removeEventListener('visibilitychange', flushPendingChanges)
      window.removeEventListener('pagehide', flushPendingChanges)
    }
  }, [saveCurrentProject])

  return {
    projectName,
    setProjectName,
    currentProjectId,
    projects,
    saveStatus,
    lastSavedAt,
    persistenceReady,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletingProject,
    saveCurrentProject,
    applyGeneratedProjectName,
    openProject,
    createNewProject,
    duplicateCurrentProject,
    deleteCurrentProject,
  }
}

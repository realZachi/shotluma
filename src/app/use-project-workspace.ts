import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { hydrateProjectAssets } from '../asset-store'
import { createInitialSlides } from '../data'
import {
  deleteProject,
  loadProject,
  loadProjectWorkspace,
  removeLegacyProject,
  saveProject,
  setActiveProjectId,
  type PersistedProject,
  type ProjectSummary,
} from '../persistence'
import { uid } from '../utils'
import { DEFAULT_PROJECT_NAME, getUniqueProjectName, upsertProjectSummary } from './project-utils'
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
}

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

const importSharedProjectOnce = (existingProjects: ProjectSummary[]): Promise<SharedImportResult> => {
  sharedImportRequest ??= importSharedProject(existingProjects)
  return sharedImportRequest
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
}: ProjectWorkspaceOptions) {
  const [projectName, setProjectNameState] = useState(initialProjectName)
  const projectNameRef = useRef(initialProjectName)
  const [currentProjectId, setCurrentProjectId] = useState('current')
  const currentProjectIdRef = useRef('current')
  const currentProjectCreatedAtRef = useRef(0)
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
        const project = imported ?? workspace.activeProject ?? makeNewProject(
          projectNameRef.current,
          slidesRef.current,
          uploadsRef.current,
        )
        if (!imported && !workspace.activeProject) await saveProject(project)
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
        }
        removeLegacyProject()
        skipNextAutoSaveRef.current = true
        setSaveStatus('saved')
      } catch {
        if (!isCancelled()) setSaveStatus('error')
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
    const snapshot: PersistedProject = {
      id: currentProjectIdRef.current,
      projectName: projectNameRef.current.trim() || DEFAULT_PROJECT_NAME,
      slides: slidesRef.current,
      uploads: uploadsRef.current,
      createdAt: currentProjectCreatedAtRef.current,
      savedAt,
    }

    setSaveStatus('saving')
    const saveRequest = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProject(snapshot))
    saveQueueRef.current = saveRequest

    try {
      await saveRequest
      removeLegacyProject()
      if (attempt === saveAttemptRef.current && revision === changeRevisionRef.current) {
        setSaveStatus('saved')
        setLastSavedAt(savedAt)
      }
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
  }, [setToast, slidesRef, uploadsRef])

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
      const project = await operation()
      await setActiveProjectId(project.id)
      skipNextAutoSaveRef.current = true
      replaceProject(project)
      setProjects((current) => upsertProjectSummary(current, project))
      setSaveStatus('saved')
      setToast(successMessage)
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
    openProject,
    createNewProject,
    duplicateCurrentProject,
    deleteCurrentProject,
  }
}

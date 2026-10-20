import { act, createElement, useRef, type Dispatch, type SetStateAction } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadProject,
  loadProjectWorkspace,
  ProjectSaveConflictError,
  saveProject,
  setActiveProjectId,
  type PersistedProject,
  type ProjectSummary,
} from '../persistence'
import { useProjectWorkspace } from './use-project-workspace'
import type { Slide, UploadAsset } from '../types'

vi.mock('../asset-store', () => ({
  hydrateProjectAssets: vi.fn(async (project: PersistedProject) => project),
}))

vi.mock('../data', () => ({
  createInitialSlides: vi.fn(() => []),
}))

vi.mock('../persistence', () => ({
  ProjectSaveConflictError: class ProjectSaveConflictError extends Error {
    constructor() {
      super('This project changed in another tab.')
      this.name = 'ProjectSaveConflictError'
    }
  },
  deleteProject: vi.fn(),
  loadProject: vi.fn(),
  loadProjectWorkspace: vi.fn(),
  removeLegacyProject: vi.fn(),
  saveProject: vi.fn(),
  setActiveProjectId: vi.fn(),
}))

vi.mock('./share-link', () => ({
  consumeShareLinkHash: vi.fn(() => null),
  decodeSharePayload: vi.fn(),
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

function makeDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined
  let rejectPromise: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    resolve: (value) => {
      if (!resolvePromise) throw new Error('Deferred promise was not initialized')
      resolvePromise(value)
    },
    reject: (reason) => {
      if (!rejectPromise) throw new Error('Deferred promise was not initialized')
      rejectPromise(reason)
    },
  }
}

const makeProject = (id: string, projectName: string, savedAt: number): PersistedProject => ({
  id,
  projectName,
  createdAt: savedAt - 1,
  savedAt,
  slides: [],
  uploads: [],
})

const summarizeProject = (project: PersistedProject): ProjectSummary => ({
  id: project.id,
  projectName: project.projectName,
  createdAt: project.createdAt,
  savedAt: project.savedAt,
})

const initialSlides: Slide[] = []
const initialUploads: UploadAsset[] = []
const setSlides: Dispatch<SetStateAction<Slide[]>> = () => undefined
const setUploads: Dispatch<SetStateAction<UploadAsset[]>> = () => undefined
const toastMessages: (string | null)[] = []
const setToast: Dispatch<SetStateAction<string | null>> = (message) => {
  toastMessages.push(typeof message === 'function' ? message(null) : message)
}
const isAiRunActive = () => false

type ProjectWorkspace = ReturnType<typeof useProjectWorkspace>

const mountedRoots: Root[] = []

const mountWorkspace = async (
  activeProject: PersistedProject,
  projects: PersistedProject[],
) => {
  const replacementSignals = new Map<string, Deferred<undefined>>()
  const waitForReplacement = (projectId: string) => {
    let signal = replacementSignals.get(projectId)
    if (!signal) {
      signal = makeDeferred<undefined>()
      replacementSignals.set(projectId, signal)
    }
    return signal.promise
  }
  const activeProjectReplaced = waitForReplacement(activeProject.id)
  let workspace: ProjectWorkspace | undefined
  const onProjectReplaced = (project: PersistedProject) => {
    replacementSignals.get(project.id)?.resolve(undefined)
  }

  vi.mocked(loadProjectWorkspace).mockResolvedValue({
    activeProject,
    projects: projects.map(summarizeProject),
  })
  vi.mocked(setActiveProjectId).mockResolvedValue(undefined)

  const Harness = () => {
    const slidesRef = useRef(initialSlides)
    const uploadsRef = useRef(initialUploads)
    workspace = useProjectWorkspace({
      initialProjectName: activeProject.projectName,
      slides: initialSlides,
      setSlides,
      slidesRef,
      uploads: initialUploads,
      setUploads,
      uploadsRef,
      onProjectReplaced,
      setToast,
      isAiRunActive,
    })

    return null
  }

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  await act(async () => {
    root.render(createElement(Harness))
  })
  await act(async () => {
    await activeProjectReplaced
  })

  return {
    getWorkspace: () => {
      if (!workspace) throw new Error('Workspace has not rendered')
      return workspace
    },
    waitForReplacement,
  }
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'))
  vi.mocked(loadProject).mockReset()
  vi.mocked(loadProjectWorkspace).mockReset()
  vi.mocked(saveProject).mockReset()
  vi.mocked(setActiveProjectId).mockReset()
  vi.mocked(saveProject).mockResolvedValue(undefined)
  vi.mocked(loadProject).mockResolvedValue(null)
  toastMessages.length = 0
  window.history.replaceState(null, '', '/')
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('project workspace persistence', () => {
  it('lets the user open another project after a stale save conflict', async () => {
    const activeProject = makeProject('active', 'Active project', 100)
    const otherProject = makeProject('other', 'Other project', 200)
    const workspace = await mountWorkspace(activeProject, [activeProject, otherProject])
    vi.mocked(loadProject).mockResolvedValue(otherProject)
    vi.mocked(saveProject).mockRejectedValueOnce(new ProjectSaveConflictError())

    await act(async () => {
      workspace.getWorkspace().setProjectName('Rejected stale edit')
      await workspace.getWorkspace().saveCurrentProject()
    })

    const otherProjectReplaced = workspace.waitForReplacement(otherProject.id)
    await act(async () => {
      workspace.getWorkspace().openProject(otherProject.id)
      await vi.waitFor(() => expect(loadProject).toHaveBeenCalledWith(otherProject.id))
      await otherProjectReplaced
    })

    expect(workspace.getWorkspace().currentProjectId).toBe(otherProject.id)
  })

  it('keeps the conflict warning when a transition save discovers a conflict', async () => {
    const activeProject = makeProject('active', 'Active project', 100)
    const otherProject = makeProject('other', 'Other project', 200)
    const workspace = await mountWorkspace(activeProject, [activeProject, otherProject])
    vi.mocked(loadProject).mockResolvedValue(otherProject)
    vi.mocked(saveProject).mockRejectedValueOnce(new ProjectSaveConflictError())
    vi.mocked(loadProject).mockClear()
    vi.mocked(setActiveProjectId).mockClear()

    await act(async () => {
      workspace.getWorkspace().openProject(otherProject.id)
      await vi.waitFor(() => {
        expect(
          toastMessages.some((message) =>
            message?.includes('Another tab saved a newer project version'),
          ),
        ).toBe(true)
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(loadProject).not.toHaveBeenCalledWith(otherProject.id)
    expect(setActiveProjectId).not.toHaveBeenCalledWith(otherProject.id)
    expect(workspace.getWorkspace().currentProjectId).toBe(activeProject.id)
    expect(toastMessages.at(-1)).toContain('Another tab saved a newer project version')
  })

  it('keeps the active project when a queued save conflicts during a transition', async () => {
    const activeProject = makeProject('active', 'Active project', 100)
    const otherProject = makeProject('other', 'Other project', 200)
    const firstSave = makeDeferred<undefined>()
    const secondSave = makeDeferred<undefined>()
    const firstSaveStarted = makeDeferred<undefined>()
    const secondSaveStarted = makeDeferred<undefined>()
    const workspace = await mountWorkspace(activeProject, [activeProject, otherProject])
    let activeSaveCount = 0

    vi.mocked(loadProject).mockResolvedValue(otherProject)
    vi.mocked(saveProject).mockImplementation((project) => {
      if (project.id !== activeProject.id) return Promise.resolve()
      activeSaveCount += 1
      if (activeSaveCount === 1) {
        firstSaveStarted.resolve(undefined)
        return firstSave.promise
      }
      if (activeSaveCount === 2) {
        secondSaveStarted.resolve(undefined)
        return secondSave.promise
      }
      return Promise.resolve()
    })
    vi.mocked(loadProject).mockClear()
    vi.mocked(setActiveProjectId).mockClear()

    await act(async () => {
      workspace.getWorkspace().openProject(otherProject.id)
      await firstSaveStarted.promise
    })

    await act(async () => {
      workspace.getWorkspace().setProjectName('Edited while saving')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })

    await act(async () => {
      firstSave.resolve(undefined)
      await secondSaveStarted.promise
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(loadProject).not.toHaveBeenCalledWith(otherProject.id)

    await act(async () => {
      secondSave.reject(new ProjectSaveConflictError())
      await vi.waitFor(() => {
        expect(toastMessages.at(-1)).toContain(
          'Another tab saved a newer project version',
        )
      })
    })

    expect(loadProject).not.toHaveBeenCalledWith(otherProject.id)
    expect(setActiveProjectId).not.toHaveBeenCalledWith(otherProject.id)
    expect(workspace.getWorkspace().currentProjectId).toBe(activeProject.id)
  })

  it('keeps queued save versions attached to their project across a switch', async () => {
    const activeProject = makeProject('active', 'Active project', 100)
    const otherProject = makeProject('other', 'Other project', 500)
    const firstSave = makeDeferred<undefined>()
    const secondSave = makeDeferred<undefined>()
    const firstSaveStarted = makeDeferred<undefined>()
    const secondSaveStarted = makeDeferred<undefined>()
    const otherProjectLoad = makeDeferred<PersistedProject | null>()
    const otherProjectLoadStarted = makeDeferred<undefined>()
    const workspace = await mountWorkspace(activeProject, [activeProject, otherProject])
    let activeSaveCount = 0

    vi.mocked(loadProject).mockImplementation((projectId) => {
      if (projectId !== otherProject.id) return Promise.resolve(null)
      otherProjectLoadStarted.resolve(undefined)
      return otherProjectLoad.promise
    })
    vi.mocked(saveProject).mockImplementation((project) => {
      if (project.id !== activeProject.id) return Promise.resolve()
      activeSaveCount += 1
      if (activeSaveCount === 1) {
        firstSaveStarted.resolve(undefined)
        return firstSave.promise
      }
      if (activeSaveCount === 2) {
        secondSaveStarted.resolve(undefined)
        return secondSave.promise
      }
      return Promise.resolve()
    })

    const onProjectReplaced = workspace.waitForReplacement(otherProject.id)

    await act(async () => {
      workspace.getWorkspace().openProject(otherProject.id)
      await firstSaveStarted.promise
    })

    await act(async () => {
      workspace.getWorkspace().setProjectName('Edited while saving')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })

    await act(async () => {
      firstSave.resolve(undefined)
      await secondSaveStarted.promise
    })

    expect(loadProject).not.toHaveBeenCalledWith(otherProject.id)

    await act(async () => {
      secondSave.resolve(undefined)
      await otherProjectLoadStarted.promise
    })

    await act(async () => {
      otherProjectLoad.resolve(otherProject)
      await onProjectReplaced
    })

    let saved = false
    await act(async () => {
      saved = await workspace.getWorkspace().saveCurrentProject()
    })

    expect(saved).toBe(true)
    expect(workspace.getWorkspace().currentProjectId).toBe(otherProject.id)
    expect(saveProject).toHaveBeenCalledTimes(3)
    expect(saveProject).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ id: otherProject.id }),
      otherProject.savedAt,
    )
  })
})

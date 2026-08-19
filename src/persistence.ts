import {
  collectPersistedAssetIds,
  dehydrateProjectAssets,
  hydrateProjectAssets,
  sweepUnusedAssets,
} from './asset-store'
import { openDatabase, PROJECT_STORE, SETTINGS_STORE } from './persistence-db'
import type { Slide, UploadAsset } from './types'

const ACTIVE_PROJECT_KEY = 'activeProjectId'
const LEGACY_STORAGE_KEY = 'frameflow-project-v5'

export type PersistedProject = {
  id: string
  projectName: string
  slides: Slide[]
  uploads: UploadAsset[]
  createdAt: number
  savedAt: number
}

export type ProjectSummary = Pick<PersistedProject, 'id' | 'projectName' | 'createdAt' | 'savedAt'>

type SettingRecord = { key: string; value: string }

export const normalizePersistedProject = (value: unknown): PersistedProject | null => {
  if (!value || typeof value !== 'object') return null
  const project = value as Partial<PersistedProject>
  if (
    typeof project.id !== 'string'
    || typeof project.projectName !== 'string'
    || !Array.isArray(project.slides)
    || !Array.isArray(project.uploads)
    || typeof project.savedAt !== 'number'
  ) return null

  return {
    id: project.id,
    projectName: project.projectName,
    slides: project.slides,
    uploads: project.uploads,
    createdAt: typeof project.createdAt === 'number' ? project.createdAt : project.savedAt,
    savedAt: project.savedAt,
  }
}

const summarizeProject = (project: PersistedProject): ProjectSummary => ({
  id: project.id,
  projectName: project.projectName,
  createdAt: project.createdAt,
  savedAt: project.savedAt,
})

const sortSummaries = (projects: ProjectSummary[]) => [...projects].sort((a, b) => b.savedAt - a.savedAt)

const readProjectRecord = (database: IDBDatabase, projectId: string): Promise<PersistedProject | null> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readonly')
    const request = transaction.objectStore(PROJECT_STORE).get(projectId)
    request.onsuccess = () => resolve(normalizePersistedProject(request.result))
    request.onerror = () => reject(request.error ?? new Error('The local project could not be loaded.'))
  })

type WorkspaceRecords = { summaries: ProjectSummary[]; activeProject: PersistedProject | null }

// A cursor walk keeps only one project document deserialized at a time, so
// startup memory peaks at the largest single project instead of the sum of
// every project — the full document is retained only for the active one.
const readWorkspaceRecords = (database: IDBDatabase): Promise<WorkspaceRecords> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECT_STORE, SETTINGS_STORE], 'readonly')
    const summaries: ProjectSummary[] = []
    let activeProject: PersistedProject | null = null

    const activeRequest = transaction.objectStore(SETTINGS_STORE).get(ACTIVE_PROJECT_KEY)
    activeRequest.onsuccess = () => {
      const configuredId = (activeRequest.result as SettingRecord | undefined)?.value
      const cursorRequest = transaction.objectStore(PROJECT_STORE).openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return
        const project = normalizePersistedProject(cursor.value)
        if (project) {
          summaries.push(summarizeProject(project))
          if (project.id === configuredId) activeProject = project
        }
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve({ summaries: sortSummaries(summaries), activeProject })
    transaction.onerror = () => reject(transaction.error ?? new Error('Local projects could not be loaded.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Loading local projects was cancelled.'))
  })

export const loadProjectWorkspace = async (): Promise<{ activeProject: PersistedProject | null; projects: ProjectSummary[] }> => {
  const database = await openDatabase()
  const { summaries, activeProject } = await readWorkspaceRecords(database)
  const fallbackId = summaries[0]?.id
  const record = activeProject ?? (fallbackId ? await readProjectRecord(database, fallbackId) : null)
  return {
    activeProject: record ? await hydrateProjectAssets(record) : null,
    projects: summaries,
  }
}

export const loadProject = async (projectId: string): Promise<PersistedProject | null> => {
  const database = await openDatabase()
  const record = await readProjectRecord(database, projectId)
  return record ? hydrateProjectAssets(record) : null
}

export const saveProject = async (project: PersistedProject): Promise<void> => {
  // Image blobs are written before the document that references them, so a
  // failed save can leave an unreferenced blob but never a dangling reference.
  const record = await dehydrateProjectAssets(project)
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The local project could not be saved.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving the local project was cancelled.'))
  })
}

export const setActiveProjectId = async (projectId: string): Promise<void> => {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SETTINGS_STORE, 'readwrite')
    transaction.objectStore(SETTINGS_STORE).put({ key: ACTIVE_PROJECT_KEY, value: projectId } satisfies SettingRecord)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The active project could not be saved.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Switching projects was cancelled.'))
  })
}

const collectRemainingAssetIds = (database: IDBDatabase): Promise<Set<string>> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readonly')
    const keep = new Set<string>()
    const cursorRequest = transaction.objectStore(PROJECT_STORE).openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) return
      const project = normalizePersistedProject(cursor.value)
      if (project) {
        for (const id of collectPersistedAssetIds(project)) keep.add(id)
      }
      cursor.continue()
    }
    transaction.oncomplete = () => resolve(keep)
    transaction.onerror = () => reject(transaction.error ?? new Error('Local projects could not be scanned.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Scanning local projects was cancelled.'))
  })

export const deleteProject = async (projectId: string): Promise<void> => {
  const database = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).delete(projectId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The local project could not be deleted.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Deleting the project was cancelled.'))
  })

  // Best effort: reclaim image blobs no surviving project references. The
  // project deletion above already succeeded, so a failed sweep only leaves
  // unused blobs on disk for the next sweep to pick up.
  try {
    await sweepUnusedAssets(await collectRemainingAssetIds(database))
  } catch {
    // Ignored — see above.
  }
}

export const loadLegacyProject = (): { slides: Slide[]; uploads: UploadAsset[] } | null => {
  try {
    const saved = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as { slides?: Slide[]; uploads?: UploadAsset[] }
    if (!Array.isArray(parsed.slides)) return null
    return { slides: parsed.slides, uploads: parsed.uploads ?? [] }
  } catch {
    return null
  }
}

export const removeLegacyProject = () => {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // IndexedDB remains the source of truth if localStorage is unavailable.
  }
}

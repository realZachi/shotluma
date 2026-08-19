// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { ASSET_REF_PREFIX } from './asset-store'
import {
  deleteProject,
  loadProject,
  loadProjectWorkspace,
  saveProject,
  setActiveProjectId,
  type PersistedProject,
} from './persistence'
import { ASSET_STORE, PROJECT_STORE, openDatabase } from './persistence-db'
import type { Slide } from './types'

const dataUrl = (payload: string) => `data:image/png;base64,${btoa(payload)}`

const makeSlide = (id: string, overrides: Partial<Slide> = {}): Slide => ({
  id,
  name: id,
  background: { type: 'solid', color1: '#000', color2: '#000', angle: 0 },
  elements: [],
  ...overrides,
})

const makeProject = (id: string, src: string, savedAt: number): PersistedProject => ({
  id,
  projectName: `Project ${id}`,
  slides: [
    makeSlide(`${id}-slide`, {
      background: { type: 'image', color1: '#000', color2: '#000', angle: 0, image: src },
      elements: [{
        id: `${id}-image`, type: 'image', x: 0, y: 0, width: 10, rotation: 0, opacity: 1,
        src, borderRadius: 0,
      }],
    }),
  ],
  uploads: [{ id: `${id}-upload`, name: 'shot.png', src }],
  createdAt: savedAt,
  savedAt,
})

const readRawRecord = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error ?? new Error('read failed'))
  })
}

const writeRawRecord = async (storeName: string, record: unknown): Promise<void> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('write failed'))
  })
}

describe('blob asset persistence', () => {
  it('persists image sources as blob-asset references and rehydrates one object URL per asset', async () => {
    const source = dataUrl('roundtrip-image')
    await saveProject(makeProject('roundtrip', source, 100))

    const raw = await readRawRecord<PersistedProject>(PROJECT_STORE, 'roundtrip')
    const ref = raw?.uploads[0]?.src
    expect(ref).toMatch(new RegExp(`^${ASSET_REF_PREFIX}[0-9a-f]{64}$`))
    expect(raw?.slides[0]?.background.image).toBe(ref)
    expect(raw?.slides[0]?.elements[0]).toMatchObject({ src: ref })
    expect(JSON.stringify(raw)).not.toContain('base64')

    const assetId = (ref ?? '').slice(ASSET_REF_PREFIX.length)
    const asset = await readRawRecord<{ id: string; blob: Blob }>(ASSET_STORE, assetId)
    expect(asset?.blob).toBeInstanceOf(Blob)

    const loaded = await loadProject('roundtrip')
    const url = loaded?.uploads[0]?.src
    expect(url).toMatch(/^blob:/)
    expect(loaded?.slides[0]?.background.image).toBe(url)
    expect(loaded?.slides[0]?.elements[0]).toMatchObject({ src: url })
  })

  it('migrates legacy inline data URLs to references on the first save after loading', async () => {
    const legacySource = dataUrl('legacy-inline-image')
    await writeRawRecord(PROJECT_STORE, makeProject('legacy', legacySource, 200))

    const loaded = await loadProject('legacy')
    expect(loaded?.uploads[0]?.src).toMatch(/^blob:/)
    if (!loaded) throw new Error('legacy project failed to load')

    await saveProject(loaded)
    const raw = await readRawRecord<PersistedProject>(PROJECT_STORE, 'legacy')
    expect(raw?.uploads[0]?.src).toMatch(new RegExp(`^${ASSET_REF_PREFIX}`))
    expect(JSON.stringify(raw)).not.toContain('base64')
  })

  it('loads the workspace as summaries plus the hydrated configured project', async () => {
    await saveProject(makeProject('workspace-old', dataUrl('workspace-old-image'), 300))
    await saveProject(makeProject('workspace-new', dataUrl('workspace-new-image'), 400))
    await setActiveProjectId('workspace-old')

    const workspace = await loadProjectWorkspace()
    expect(workspace.activeProject?.id).toBe('workspace-old')
    expect(workspace.activeProject?.uploads[0]?.src).toMatch(/^blob:/)
    const ids = workspace.projects.map((project) => project.id)
    expect(ids.indexOf('workspace-new')).toBeLessThan(ids.indexOf('workspace-old'))
    expect(workspace.projects.every((project) => !('slides' in project))).toBe(true)
  })

  it('falls back to the most recently saved project when the configured id is stale', async () => {
    await setActiveProjectId('does-not-exist')
    const workspace = await loadProjectWorkspace()
    expect(workspace.activeProject?.id).toBe(workspace.projects[0]?.id)
  })

  it('sweeps blobs only the deleted project referenced and keeps shared ones', async () => {
    const orphanId = 'f'.repeat(64)
    const sharedId = 'e'.repeat(64)
    await writeRawRecord(ASSET_STORE, { id: orphanId, blob: new Blob(['orphan']) })
    await writeRawRecord(ASSET_STORE, { id: sharedId, blob: new Blob(['shared']) })
    await writeRawRecord(PROJECT_STORE, makeProject('doomed', `${ASSET_REF_PREFIX}${orphanId}`, 500))
    await writeRawRecord(PROJECT_STORE, makeProject('survivor', `${ASSET_REF_PREFIX}${sharedId}`, 600))

    await deleteProject('doomed')

    expect(await readRawRecord(PROJECT_STORE, 'doomed')).toBeUndefined()
    expect(await readRawRecord(ASSET_STORE, orphanId)).toBeUndefined()
    expect(await readRawRecord(ASSET_STORE, sharedId)).toBeDefined()
  })
})

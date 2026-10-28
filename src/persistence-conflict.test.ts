// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  loadProject,
  saveProject,
  saveProjectIfCurrent,
  type PersistedProject,
} from './persistence'
import type { Slide } from './types'

const makeSlide = (id: string): Slide => ({
  id,
  name: id,
  background: { type: 'solid', color1: '#000', color2: '#000', angle: 0 },
  elements: [],
})

const makeProject = (overrides: Partial<PersistedProject> = {}): PersistedProject => ({
  id: 'shared-project',
  projectName: 'Midnight pitch',
  slides: [makeSlide('slide-1'), makeSlide('slide-2')],
  uploads: [],
  createdAt: 100,
  savedAt: 100,
  ...overrides,
})

describe('cross-tab save conflicts', () => {
  it('rejects a save made against a stale baseline instead of overwriting a newer save', async () => {
    // Tab A loads the project, then applies a six-slide design and saves it.
    const tabAView = makeProject({ savedAt: 100 })
    await saveProject(tabAView)

    const newerDesign = makeProject({
      slides: [makeSlide('s1'), makeSlide('s2'), makeSlide('s3'), makeSlide('s4'), makeSlide('s5'), makeSlide('s6')],
      savedAt: 200,
    })
    const tabASaveOutcome = await saveProjectIfCurrent(newerDesign, 100)
    expect(tabASaveOutcome).toEqual({ status: 'saved' })

    // Tab B loaded the project before tab A's save (so it still only knows
    // about the original `savedAt: 100` baseline) and only changes the name.
    const tabBStaleSnapshot = makeProject({ projectName: 'Renamed in tab B', savedAt: 300 })
    const tabBSaveOutcome = await saveProjectIfCurrent(tabBStaleSnapshot, 100)

    expect(tabBSaveOutcome.status).toBe('conflict')
    if (tabBSaveOutcome.status !== 'conflict') throw new Error('expected a conflict')
    // The conflict result carries the newer record so the caller can adopt
    // it, instead of the caller having to issue a second read.
    expect(tabBSaveOutcome.current.savedAt).toBe(200)
    expect(tabBSaveOutcome.current.slides).toHaveLength(6)

    // The newer design must still be the one on disk — tab B's stale,
    // two-slide snapshot must never have overwritten it.
    const persisted = await loadProject('shared-project')
    expect(persisted?.savedAt).toBe(200)
    expect(persisted?.slides).toHaveLength(6)
    expect(persisted?.projectName).toBe('Midnight pitch')
  })

  it('saves normally when the baseline still matches what is stored', async () => {
    await saveProject(makeProject({ id: 'solo-project', savedAt: 100 }))

    const outcome = await saveProjectIfCurrent(
      makeProject({ id: 'solo-project', projectName: 'Renamed', savedAt: 150 }),
      100,
    )

    expect(outcome).toEqual({ status: 'saved' })
    const persisted = await loadProject('solo-project')
    expect(persisted?.projectName).toBe('Renamed')
    expect(persisted?.savedAt).toBe(150)
  })

  it('treats a null baseline as "no local copy expected yet" and always writes', async () => {
    const outcome = await saveProjectIfCurrent(makeProject({ id: 'brand-new', savedAt: 100 }), null)
    expect(outcome).toEqual({ status: 'saved' })
    expect((await loadProject('brand-new'))?.savedAt).toBe(100)
  })
})

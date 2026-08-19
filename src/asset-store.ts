import { collectAssetSources, mapAssetSources, type ProjectAssetSources } from './asset-sources'
import { ASSET_STORE, openDatabase } from './persistence-db'
import { fileToDataUrl } from './utils'

/**
 * Content-addressed image storage. Image bytes live as Blobs in the `assets`
 * IndexedDB store, which Chrome keeps disk-backed; project documents persist
 * only `blob-asset:<sha-256>` references, and the running app renders object
 * URLs, so image data never sits in the JS heap as a base64 string. Hash ids
 * make writes idempotent and deduplicate identical images across projects.
 */

export const ASSET_REF_PREFIX = 'blob-asset:'

type AssetRecord = { id: string; blob: Blob }

export const isAssetRef = (src: string) => src.startsWith(ASSET_REF_PREFIX)

const assetIdFromRef = (src: string) => src.slice(ASSET_REF_PREFIX.length)

// One object URL per asset per session. URLs are deliberately never revoked on
// project switches: they only pin disk-backed Blobs (never heap strings), and
// unsaved state or undo history may still reference any asset seen this
// session, so revoking would break those references. Reusing the same URL
// string also keeps src equality checks (background pickers, upload dedupe)
// working. Data URLs are intentionally not memoized to their asset id — a
// cache would pin the full base64 string in the heap; re-hashing on the rare
// save that still carries one is cheaper than that.
const objectUrlByAssetId = new Map<string, string>()
const assetIdByObjectUrl = new Map<string, string>()

const toObjectUrl = (id: string, blob: Blob): string => {
  const cached = objectUrlByAssetId.get(id)
  if (cached) return cached
  const url = URL.createObjectURL(blob)
  objectUrlByAssetId.set(id, url)
  assetIdByObjectUrl.set(url, id)
  return url
}

const hashBlob = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) throw new Error('Malformed data URL.')
  const header = dataUrl.slice(0, comma)
  const type = /^data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream'
  const payload = dataUrl.slice(comma + 1)
  if (!header.includes(';base64')) return new Blob([decodeURIComponent(payload)], { type })
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}

const putAssetRecord = async (record: AssetRecord): Promise<void> => {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    transaction.objectStore(ASSET_STORE).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('The image could not be stored locally.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Storing the image was cancelled.'))
  })
}

const storeBlobAsset = async (blob: Blob): Promise<{ id: string; url: string }> => {
  const id = await hashBlob(blob)
  if (!objectUrlByAssetId.has(id)) await putAssetRecord({ id, blob })
  return { id, url: toObjectUrl(id, blob) }
}

/**
 * Stores an uploaded image and returns the src to render it with. Falls back
 * to an inline data URL when Blob storage is unavailable (e.g. private
 * browsing), which keeps uploads working exactly as before the asset store.
 */
export const importBlobAsset = async (blob: Blob): Promise<string> => {
  try {
    return (await storeBlobAsset(blob)).url
  } catch {
    return fileToDataUrl(blob)
  }
}

/** Same fallback contract as {@link importBlobAsset}, for data URL inputs. */
export const importDataUrlAsset = async (dataUrl: string): Promise<string> => {
  try {
    return (await storeBlobAsset(dataUrlToBlob(dataUrl))).url
  } catch {
    return dataUrl
  }
}

const loadAssetObjectUrls = async (ids: string[]): Promise<Map<string, string>> => {
  const resolved = new Map<string, string>()
  const missing = ids.filter((id) => {
    const cached = objectUrlByAssetId.get(id)
    if (cached) resolved.set(id, cached)
    return !cached
  })
  if (missing.length === 0) return resolved

  const database = await openDatabase()
  const records = await new Promise<(AssetRecord | undefined)[]>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readonly')
    const store = transaction.objectStore(ASSET_STORE)
    const requests = missing.map((id) => store.get(id))
    transaction.oncomplete = () => resolve(requests.map((request) => request.result as AssetRecord | undefined))
    transaction.onerror = () => reject(transaction.error ?? new Error('Local images could not be loaded.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Loading local images was cancelled.'))
  })
  for (const record of records) {
    if (record) resolved.set(record.id, toObjectUrl(record.id, record.blob))
  }
  return resolved
}

/**
 * Resolves a freshly loaded project for rendering: `blob-asset:` references
 * become object URLs, and legacy inline data URLs (projects saved before the
 * asset store existed) are converted into stored Blobs on the spot so the next
 * save persists references instead of megabytes of base64.
 */
export const hydrateProjectAssets = async <T extends ProjectAssetSources>(project: T): Promise<T> => {
  const sources = collectAssetSources(project)
  const referencedIds = [...sources].filter(isAssetRef).map(assetIdFromRef)
  const urlsById = await loadAssetObjectUrls(referencedIds).catch(() => new Map<string, string>())

  const replacements = new Map<string, string>()
  for (const src of sources) {
    if (isAssetRef(src)) {
      const url = urlsById.get(assetIdFromRef(src))
      if (url) replacements.set(src, url)
    } else if (src.startsWith('data:')) {
      replacements.set(src, await importDataUrlAsset(src))
    }
  }
  return mapAssetSources(project, (src) => replacements.get(src) ?? src)
}

/**
 * Prepares a project snapshot for persistence: object URLs and any remaining
 * inline data URLs become `blob-asset:` references. Sources that cannot be
 * stored (or are regular bundled/HTTP URLs) are kept as-is, so a failed Blob
 * write degrades to today's inline persistence instead of losing the image.
 */
export const dehydrateProjectAssets = async <T extends ProjectAssetSources>(project: T): Promise<T> => {
  const replacements = new Map<string, string>()
  for (const src of collectAssetSources(project)) {
    const registeredId = assetIdByObjectUrl.get(src)
    if (registeredId) {
      replacements.set(src, `${ASSET_REF_PREFIX}${registeredId}`)
    } else if (src.startsWith('data:')) {
      try {
        const { id } = await storeBlobAsset(dataUrlToBlob(src))
        replacements.set(src, `${ASSET_REF_PREFIX}${id}`)
      } catch {
        // Keep the data URL inline; the project still round-trips.
      }
    }
  }
  return mapAssetSources(project, (src) => replacements.get(src) ?? src)
}

/** Asset ids referenced by a persisted (dehydrated) project document. */
export const collectPersistedAssetIds = (project: ProjectAssetSources): Set<string> =>
  new Set([...collectAssetSources(project)].filter(isAssetRef).map(assetIdFromRef))

/**
 * Deletes stored Blobs that no surviving project references. `keepIds` must
 * include the ids referenced by every remaining persisted project; everything
 * registered this session is also kept, because unsaved in-memory state (and
 * legacy documents migrated on load but not yet saved) can reference assets
 * that no document mentions yet.
 */
export const sweepUnusedAssets = async (keepIds: Set<string>): Promise<void> => {
  const database = await openDatabase()
  const storedIds = await new Promise<string[]>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readonly')
    const request = transaction.objectStore(ASSET_STORE).getAllKeys()
    request.onsuccess = () => resolve(request.result.map(String))
    request.onerror = () => reject(request.error ?? new Error('Local images could not be listed.'))
  })
  const unused = storedIds.filter((id) => !keepIds.has(id) && !objectUrlByAssetId.has(id))
  if (unused.length === 0) return

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite')
    const store = transaction.objectStore(ASSET_STORE)
    for (const id of unused) store.delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Unused local images could not be removed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Removing unused local images was cancelled.'))
  })
}

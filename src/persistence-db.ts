// Keep the established IndexedDB name so rebranding never strands local projects.
const DATABASE_NAME = 'frameflow'
const DATABASE_VERSION = 3

export const PROJECT_STORE = 'projects'
export const SETTINGS_STORE = 'settings'
export const ASSET_STORE = 'assets'

let databasePromise: Promise<IDBDatabase> | null = null

export const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false

    const fail = (error: Error) => {
      settled = true
      databasePromise = null
      reject(error)
    }

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PROJECT_STORE)) {
        request.result.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
      }
      if (!request.result.objectStoreNames.contains(SETTINGS_STORE)) {
        request.result.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
      if (!request.result.objectStoreNames.contains(ASSET_STORE)) {
        request.result.createObjectStore(ASSET_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      if (settled) {
        request.result.close()
        return
      }
      settled = true
      request.result.onversionchange = () => {
        request.result.close()
        databasePromise = null
      }
      resolve(request.result)
    }
    request.onerror = () => fail(request.error ?? new Error('Local project storage could not be opened.'))
    request.onblocked = () => fail(new Error('Local project storage is blocked by another tab.'))
  })

  return databasePromise
}

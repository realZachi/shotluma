export type SaveStatus = 'loading' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

export const saveStatusLabels: Record<SaveStatus, string> = {
  loading: 'Loading local project …',
  dirty: 'Unsaved',
  saving: 'Saving locally …',
  saved: 'Saved locally',
  error: 'Couldn’t save',
  conflict: 'Loaded newer version',
}

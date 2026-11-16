import {
  inlineImageSources,
  normalizeSharedProject,
  SHARE_FORMAT_VERSION,
  type SharedProjectPayload,
} from './share-link'

/** Produces a filesystem-safe `.shotluma.json` filename from the project name. */
export const getProjectJsonFilename = (projectName: string): string => {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'shotluma-project'}.shotluma.json`
}

/** Serializes a self-contained project backup with inlined image data URLs. */
export const exportProjectJson = async (project: SharedProjectPayload): Promise<string> => {
  const inlined = await inlineImageSources(project)
  return JSON.stringify({ v: SHARE_FORMAT_VERSION, ...inlined }, null, 2)
}

/** Parses and validates an exported Shotluma JSON project file. */
export const parseProjectJson = (text: string): SharedProjectPayload | null => {
  try {
    const parsed: unknown = JSON.parse(text)
    return normalizeSharedProject(parsed)
  } catch {
    return null
  }
}

export const downloadProjectJson = (projectName: string, json: string): void => {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getProjectJsonFilename(projectName)
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

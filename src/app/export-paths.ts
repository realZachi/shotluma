export const getSafeFilename = (name: string, fallback: string) =>
  name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || fallback

export const getSlidePngFilename = (index: number, slideName: string) =>
  `${String(index + 1).padStart(2, '0')}-${getSafeFilename(slideName, `Screen-${index + 1}`)}.png`

export const getExportZipEntryPath = (
  formatFilename: string,
  index: number,
  slideName: string,
  nested: boolean,
  locale?: string,
) => {
  const filename = getSlidePngFilename(index, slideName)
  const path = nested ? `${formatFilename}/${filename}` : filename
  return locale && locale !== 'en-US' ? `${locale}/${path}` : path
}

export const getExportZipDownloadName = (
  projectName: string,
  formatFilename: string,
) => {
  const projectFilename = getSafeFilename(projectName.trim(), 'Shotluma')
  return `${projectFilename}-${formatFilename}-Screens.zip`
}

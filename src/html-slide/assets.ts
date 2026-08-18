/** Native design size of an AI-authored HTML screen, matching the export canvas. */
export const HTML_SCREEN_WIDTH = 1290
export const HTML_SCREEN_HEIGHT = 2796

const ASSET_REFERENCE_PATTERN = /asset:([a-z0-9-]+)/gi

/**
 * Replaces `asset:<id>` references (img src, CSS url(), shotluma-device
 * screenshot attributes) with the referenced upload's data URL. Unknown ids
 * are left untouched so a broken reference stays visible instead of failing
 * silently.
 */
export const resolveAssetReferences = (
  html: string,
  resolveAssetSrc: (assetId: string) => string | undefined,
): string => html.replace(
  ASSET_REFERENCE_PATTERN,
  (reference, assetId: string) => resolveAssetSrc(assetId) ?? reference,
)

/** Lists the asset ids referenced by an HTML screen, without resolving them. */
export const collectAssetReferences = (html: string): string[] => {
  const ids = new Set<string>()
  for (const match of html.matchAll(ASSET_REFERENCE_PATTERN)) {
    const assetId = match[1]
    if (assetId) ids.add(assetId)
  }
  return [...ids]
}

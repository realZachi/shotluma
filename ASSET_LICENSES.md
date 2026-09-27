# Asset licenses and provenance

Shotluma's source code and project-authored assets are distributed under the repository's [MIT License](LICENSE). Third-party assets remain subject to their original licenses.

This file is the provenance record for visual assets committed to the repository. Package dependencies and bundled fonts carry their own licenses in their respective packages.

## Brand assets

| Files | Creator and source | License | Modifications and attribution |
| --- | --- | --- | --- |
| `public/brand/shotluma-logo.webp`, `public/favicon*`, `public/apple-touch-icon.png`, `public/icon-*.png`, `public/mstile-150x150.png`, `public/safari-pinned-tab.svg` | Shotluma project owner; source artwork supplied directly for this repository | MIT | Resized and encoded from the supplied transparent WebP. Browser favicons retain the source transparency; installable device icons add only a neutral dark background or safe-zone padding where the platform requires it. The Safari asset is a monochrome alpha-mask derivative. No external attribution required. |

## Bundled mockup overlays

The following overlays were added by the original Shotluma contributors. Git history does not contain an external source URL or separate license notice, so they are treated as project assets contributed under MIT.

| Files | Description | Repository license | External source or attribution |
| --- | --- | --- | --- |
| `src/assets/mockups/iphone-17-a.webp` through `iphone-17-f.webp` | Transparent phone mockup overlays | MIT | None recorded |
| `src/assets/mockups/tilted-hand.webp` | Transparent hand-held phone mockup overlay | MIT | None recorded |
| `src/assets/mockups/ipad-pro-portrait.png`, `src/assets/mockups/ipad-pro-landscape.png`, `src/assets/mockups/mockup-apple-ipad-pro-11-2018-transparent.png` | Transparent iPad Pro mockup overlays in portrait and landscape | MIT | User-contributed transparent overlays |
| `src/assets/mockups/android-phone.png` | Transparent modern Android phone mockup overlay | MIT | User-contributed transparent overlay |

Before making the repository public, a maintainer should confirm that the project has the right to redistribute these PSD-derived overlays under MIT. If any overlay came from a third-party template, replace the entry above with the original creator, source URL, license, required attribution, and modification details. Remove or replace an asset if its license does not allow redistribution in an open-source repository.

## Documentation media

| Files | Creator and source | License | Modifications and attribution |
| --- | --- | --- | --- |
| `docs/assets/demos/shotluma-overview.gif`, `docs/assets/demos/ai-screen-edit.gif` | Shotluma maintainer; project screen recordings supplied for this repository | MIT | Downscaled, frame-rate reduced, and palette-optimized with FFmpeg. No external attribution required. |

## Adding an asset

Every asset pull request must add or update a row with:

- Committed file path.
- Creator or copyright holder.
- Original source URL, when applicable.
- Exact license name and license URL.
- Required attribution.
- Summary of modifications.
- Confirmation that redistribution and use in generated artwork are permitted.

Do not commit an asset when its origin or redistribution rights are unclear. Purchase alone does not necessarily grant redistribution rights.

## Trademarks

Apple, App Store, iPhone, and related marks are trademarks of Apple Inc. Their mention describes compatibility and does not imply affiliation or endorsement.

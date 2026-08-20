# Editor deployment

This public repository owns the editor deployed at
`https://app.shotluma.com`. The marketing site at `https://shotluma.com` is
maintained and deployed from a separate private repository.

## GitHub Pages (SEO / project landing)

A lightweight static landing page lives in `github-pages/` and deploys to
`https://realzachi.github.io/shotluma/` via `.github/workflows/github-pages.yml`.

It exists for discovery and backlinks: the page is indexable, points
`rel="canonical"` at `https://shotluma.com/`, and links to the website, hosted
editor, and GitHub repository. It is not the marketing site and must stay
self-contained (no private marketing source, styles, or production config).

Enable Pages once under **Settings → Pages → Build and deployment → GitHub
Actions**, or with:

```bash
gh api -X POST repos/realZachi/shotluma/pages \
  -f build_type=workflow \
  -f 'source[branch]=main' \
  -f 'source[path]=/'
```

After the first successful workflow run on `main`, the site is public at the
URL above.

## Deploy

```bash
bun install --frozen-lockfile
bun run check
bun run build
bun run deploy-only
```

Pushes and merges to `main` also deploy automatically after CI quality gates
pass (`.github/workflows/ci.yml`). Configure these repository secrets:

- `CLOUDFLARE_API_TOKEN` — API token with Edit Cloudflare Workers permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

The Cloudflare custom domain is source-controlled in `wrangler.jsonc`. Do not
attach this Worker to the apex domain, and do not add marketing-site source,
styles, assets, or production-only configuration to this repository.

The Worker also runs the share API (`worker/share-worker.ts`) for short
project share links. It stores opaque share payloads in the `SHARE_KV` KV
namespace referenced in `wrangler.jsonc`; the API token therefore needs
Workers KV Storage edit permission (included in the standard Edit Cloudflare
Workers token template). The editor falls back to self-contained share links
when the API is unavailable, so a deployment without the KV binding degrades
gracefully.

Keep `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` available only to the
`bun run deploy-only` command. The GitHub Actions workflow follows the same
boundary: it builds without Cloudflare credentials and supplies them only to
the deployment step.

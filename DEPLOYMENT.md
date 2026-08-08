# Editor deployment

This public repository owns the editor deployed at
`https://app.shotluma.com`. The marketing site at `https://shotluma.com` is
maintained and deployed from a separate private repository.

## Deploy

```bash
bun install --frozen-lockfile
bun run check
bun run deploy
```

Pushes and merges to `main` also deploy automatically after CI quality gates
pass (`.github/workflows/ci.yml`). Configure these repository secrets:

- `CLOUDFLARE_API_TOKEN` — API token with Edit Cloudflare Workers permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID

The Cloudflare custom domain is source-controlled in `wrangler.jsonc`. Do not
attach this Worker to the apex domain, and do not add marketing-site source,
styles, assets, or production-only configuration to this repository.

# Shotluma architecture

This document explains the boundaries that matter when changing Shotluma. It complements the contributor guide; the source code remains the final authority.

## Runtime overview

Shotluma is a client-side React application served by Vite.

```text
Browser
├── React editor state and undo history
├── IndexedDB projects and uploads
├── DOM-rendered artboards
└── PNG/ZIP export

Optional AI path
Browser → local Shotluma bridge → Codex App Server → ChatGPT plan
Browser → AI SDK provider → Google / Qwen / OpenAI / Anthropic / xAI / OpenRouter
Browser → /api/moonshot/* → Vite proxy → Moonshot API
Browser → /api/ai-run-logs → Vite → ./ai-logs/*.json (developer opt-in)
```

The core editor has no backend requirement. Hosted users can connect a Codex app or CLI already signed in with ChatGPT on the same computer; `app.shotluma.com` remains the application host. The browser talks to a paired loopback bridge, and the bridge talks to Codex App Server over stdio. The alternative AI path uses bring-your-own keys entered in the browser (`localStorage`), with optional `.env.local` `VITE_*` fallback served only during local development. Production builds replace all provider env values with empty strings. Google, Qwen, OpenAI, Anthropic, xAI, and OpenRouter are called directly; Moonshot is enabled only on localhost and uses a same-origin proxy because its API does not support the required browser CORS flow.

This public repository contains and deploys only the editor at
`app.shotluma.com`. The marketing site at `shotluma.com` has a separate private
source repository and Cloudflare Worker. Marketing source, assets, and
production-only configuration must not be copied into this repository.

## Editor state and history

`src/App.tsx` composes the application. Responsibilities are separated into:

| Area | Location |
| --- | --- |
| Project hydration, autosave, switching, and deletion | `src/app/use-project-workspace.ts` |
| Undo/redo and live updates | `src/editor/use-editor-history.ts` |
| Element, upload, template, and slide actions | `src/editor/use-editor-actions.ts` |
| Keyboard behavior and pure nudge calculations | `src/editor/use-editor-keyboard.ts`, `src/editor/nudge.ts` |
| AI run orchestration and live activity | `src/ai/use-ai-workflow.ts` |
| PNG/ZIP export | `src/app/use-slide-export.ts` |

Slides contain a background and an ordered array of discriminated canvas elements from `src/types.ts`. Element order is also layer order. Mutations must create new objects and arrays rather than modifying existing snapshots.

Undo and redo operate on editor snapshots. A user action should create one meaningful checkpoint. AI generation deliberately creates one checkpoint for the entire run so the user can undo the result in one step.

A project can contain zero slides. In that state there is no active slide, the
canvas presents blank and AI-assisted creation paths, and the empty slide array
is persisted as normal. New projects begin empty so the editor empty state can
guide the first blank or AI-created screen.

## Rendering and coordinates

Every artboard is rendered as a 330 px-wide DOM element with the aspect ratio `1290 / 2796`. Element positions and widths are stored as percentages of the artboard; heights are derived from content or aspect ratio.

Export scales that DOM representation to the selected output size. This has one important consequence: text `fontSize` values are CSS pixels on the 330 px internal artboard. They are not percentages and are not export-resolution pixels.

A device mockup with `spansScreens` enabled is additionally rendered inside the adjacent artboards as a non-interactive ghost (`SpanGhostItem`), shifted by exactly one artboard width (±100%, `src/editor/screen-span.ts`). App Store screenshots sit flush against each other, so the editor's visual gap between artboards must never offset ghosts. Because export rasterizes the same DOM, both halves stay aligned across exported screens without a separate export path. Drag and nudge bounds for spanning devices are widened by one screen in `src/editor/drag-bounds.ts`.

Typical internal font sizes are:

- Hero headline: `32–46`
- Sub-headline: `18–24`
- Body or supporting copy: `13–17`
- Small label: `9–12`

Values over roughly `52` are usually incorrect.

## Persistence

`src/persistence.ts` stores project data and uploaded assets in IndexedDB. A small local-storage migration path exists for legacy projects.

Persistence is browser-local:

- No project account or remote database exists.
- A different browser profile has a different project store.
- Clearing site data deletes saved projects.
- Schema changes must preserve existing projects or include an explicit migration.

Avoid putting credentials or provider responses into persisted project data.

Developer AI run logging is enabled only when `SHOTLUMA_AI_LOGGING=true`. The browser sends a versioned, bounded record to the local Vite middleware, which validates it and writes one JSON file per run to the git-ignored `ai-logs/` directory in the repository. Records include normalized token usage, visible text and reasoning output, tool activity, and coarse request sizes. Shotluma does not add input prompt text, screenshot payloads or names, credentials, or raw provider metadata to the records.

## Export

`src/app/use-slide-export.ts` uses `html-to-image` to rasterize each artboard and JSZip to package the results. Output definitions live in `src/app/export-formats.ts`.

Supported output sizes are:

| Target | Dimensions |
| --- | --- |
| 6.9-inch display | `1290 × 2796` |
| 6.5-inch display | `1242 × 2688` |

The rendered artboard is the source of truth. Editor-only UI, including transform handles, selections, and elements carrying `data-ai-overlay`, must be filtered out of export.

Changes to artboard dimensions, transforms, font loading, or DOM nesting can affect image output even if the editor looks correct. Verify actual PNG dimensions after related changes.

## Device mockups

`src/mockups/catalog.ts` registers each supported mockup.

A perspective mockup contains:

- A transparent overlay.
- The overlay and screenshot aspect ratios.
- Four normalized screen corners.
- A default canvas placement.

The renderer derives a projective `matrix3d` from those corners. Do not replace this with a simple rotation for tilted devices. See `src/mockups/README.md` for the conversion format and `ASSET_LICENSES.md` for licensing requirements.

## AI generation

The AI feature is split into explicit layers:

| File | Responsibility |
| --- | --- |
| `src/ai/runner.ts` | Provider client, stream handling, and UI events |
| `src/ai/codex-app-server.ts` | Codex account verification, dynamic tools, and turn lifecycle |
| `src/ai/codex-bridge-client.ts` | Paired loopback HTTP transport and App Server RPC correlation |
| `src/ai/codex-connection.ts` | Browser pairing state and generated Codex setup prompt |
| `src/ai/prompt.ts` | Design rules and coordinate semantics |
| `src/ai/prompt-caching.ts` | Per-provider cache routing (Anthropic breakpoints, OpenAI cache keys) |
| `src/ai/tools.ts` | Tool composition and generate/edit tool boundary |
| `src/ai/*-tools.ts`, `src/ai/*-tool.ts` | Focused slide, media, text, update, inspection, and overlay-asset tools |
| `src/ai/chroma-key.ts` | Pure soft chroma-key pixel math for overlay cutouts |
| `src/ai/remove-chroma-key-background.ts` | Canvas wrapper that exports transparent PNGs |
| `src/ai/overlay-asset-prompt.ts` | Hard chroma-key constraints appended to overlay prompts, plus the per-run generation budget |
| `src/ai/run-narration.ts` | Sentence-wise accumulation of the assistant and reasoning streams |
| `src/ai/run-plan.ts` | Declared screen plan reconciled against the screens actually built |
| `src/ai/tool-context.ts` | Shared clamps, lookups, activity, and measurements |
| `src/ai/tool-schemas.ts` | Shared model-visible schemas and descriptions |
| `src/ai/controller.ts` | Allowed editor reads and mutations |
| `src/ai/measure.ts` | DOM-based element boxes and layout warnings |
| `src/ai/preview.ts` | Downscaled rendered slide previews |
| `src/ai/richtext.ts` | Safe per-word highlight markup |
| `src/ai/run-log.ts` | Versioned, privacy-bounded AI run log schema |
| `src/ai/run-log-client.ts` | Env-gated delivery to the local log endpoint |
| `scripts/ai-run-log-plugin.ts` | Validated, project-local JSON file writer |
| `scripts/shotluma-codex-bridge.ts` | Restricted loopback bridge to Codex App Server |
| `scripts/codex-bridge-asset-plugin.ts` | Emits the standalone connector as a public build asset |

The model does not receive unrestricted application access. It can only use the tools supplied by `createEditorTools`, and the controller applies per-element field whitelists.

Mutating tools return measured element bounds and layout warnings. The model can also inspect a full slide and request a rendered preview. These results close the gap between requested coordinates and the browser's actual layout.

Rich text is built from structured highlight input. The model never writes raw HTML. `sanitizeRichText` in `src/utils.ts` is the final whitelist for allowed span styles.

The generate dialog covers input only. Once a run starts it closes and `src/components/AiRunBand.tsx` takes over as a band floating over the canvas: assistant prose and reasoning at reading size (accumulated per sentence by `src/ai/run-narration.ts`), a screen rail fed by the model's `declare_plan` call and reconciled against reality by `src/ai/run-plan.ts`, and an action count in place of a tool log. The band is also where a finished or failed run reports its result, so no run hands control back to the centered dialog.

`src/ai/provider-catalog.ts` owns the selectable providers, models, transport metadata, and model-specific reasoning-effort choices. `src/ai/provider-config.ts` resolves keys from browser `localStorage` (API keys dialog) with optional `.env.local` `VITE_*` fallback, and `src/ai/runner.ts` routes either to the Codex bridge or a lazily loaded native AI SDK provider. The runner passes portable efforts through the AI SDK's standardized `reasoning` option so each native provider can map it to its own API; OpenAI GPT-5.6 and Moonshot/Kimi K3 `max` go through OpenAI-compat `providerOptions` because the shared option has no `max`. The generate modal presents one model picker grouped by provider, with reasoning effort as secondary chips when the model supports it, a Codex connection tutorial, and an API keys dialog for key-based providers. Requests go directly from the local browser to Google, Alibaba/Qwen, OpenAI, Anthropic, xAI, or OpenRouter. Moonshot uses the OpenAI chat provider through the only Vite proxy route.

Codex pairing is deliberately not OAuth inside Shotluma. The setup prompt downloads the connector asset emitted with the hosted app, asks Codex to inspect it, and starts it as a detached user process. The browser stores a random pairing token and the exact app origin. The connector binds only `127.0.0.1:47447`, stores its matching configuration with user-only permissions, requires both the exact `Origin` header and bearer pairing token, and never reads Codex authentication files. It starts `codex app-server` over stdio and allowlists only account/rate-limit/model reads plus ephemeral thread and turn methods. Thread and turn requests are overwritten to use an empty read-only workspace, no approvals, and no network. The model can change the canvas only through the same `createEditorTools` dynamic tools used by direct providers.

The bridge uses Codex App Server's experimental dynamic-tool API. Keep bridge and web-client versions compatible, fail closed on unknown RPC methods, and retain the API-key provider path as a fallback while this integration is experimental.

OpenRouter is the one provider with a runtime model catalog: `src/ai/openrouter-models.ts` fetches the public OpenRouter `/models` endpoint (no key required), keeps only models that accept image input and support tool calling, caches the result in `localStorage` for an hour, and registers it with the static catalog so selections resolve everywhere. The curated OpenRouter shortlist in `provider-catalog.ts` doubles as the offline fallback, and the model picker adds a searchable browser over the fetched catalog. Requests use the OpenAI chat provider against `https://openrouter.ai/api/v1`.

Keys are intentionally browser-visible and stored unencrypted. Never commit `.env.local` or weaken the production-build stripping of provider env values. Use dedicated keys with restrictive quotas. A hosted deployment that must hide or share credentials needs an authenticated backend.

## UI system

Editor chrome uses shadcn/ui with the configuration in `components.json`:

- Nova base
- Neutral semantic tokens
- Geist
- Base UI primitives
- Hugeicons

Reusable primitives live in `src/components/ui/`. Artboard content is intentionally exempt from the neutral editor palette because it represents the user's exported design.

`src/styles.css` preserves stylesheet order by importing `src/styles/base.css` and `src/styles/theme.css`. The base layer imports `shadcn/tailwind.css`, which makes the shadcn package a build dependency. `package.json` currently overrides `@hono/node-server` to a patched release because shadcn's optional MCP dependency requests an older major. Re-evaluate the override when the upstream dependency range changes; do not remove it without running the dependency audit and a full build.

## Safe extension checklist

When adding an element field:

1. Add it to the appropriate type in `src/types.ts`.
2. Set a safe default where the element is created.
3. Render it in the relevant component.
4. Expose an editor control if users should change it.
5. Add it to persistence-compatible data handling.
6. Add it to the controller's per-type whitelist.
7. Add it to `update_element` only if the AI should change it.
8. Update tool descriptions and prompt rules.
9. Verify undo, reload, AI editing, and export.

When adding a new AI tool:

1. Keep its scope narrower than the underlying editor controller.
2. Validate and clamp all model input.
3. Return structured failures instead of throwing for expected errors.
4. Emit useful activity coordinates when the tool changes the canvas.
5. Return measurements after mutations.
6. Keep secrets, raw data URLs, and unrelated slide state out of model output.

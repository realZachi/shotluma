# Shotluma

<img src="public/brand/shotluma-logo.webp" alt="Shotluma logo" width="120" />

An AI-first, local-first canvas editor for creating complete iOS App Store screenshot sets in the browser. The AI agent builds real, editable designs instead of flattening your ideas into generated images.

[![Open the editor](https://img.shields.io/badge/%E2%96%B6%EF%B8%8E%20Open%20the%20editor-app.shotluma.com-2563eb?style=for-the-badge)](https://app.shotluma.com)
[![Visit the website](https://img.shields.io/badge/Visit%20the%20website-shotluma.com-0f172a?style=for-the-badge)](https://shotluma.com)

[![CI](https://github.com/realZachi/shotluma/actions/workflows/ci.yml/badge.svg)](https://github.com/realZachi/shotluma/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/realZachi/shotluma?display_name=tag&sort=semver)](https://github.com/realZachi/shotluma/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-16a34a.svg)](CONTRIBUTING.md)

Describe your app, upload raw screenshots, and an AI agent designs the full set — not as opaque bitmaps, but by driving the same editor operations you'd use by hand. Every text layer, gradient, shape, and device mockup it places stays a real canvas element: select it, restyle it, move it, or redo it manually. Then export every artboard at exact store resolutions.

![Shotluma's AI agent generating a complete, editable App Store screenshot set](docs/assets/demos/shotluma-overview.gif)

Projects live entirely in your browser — no Shotluma account or project backend. The editor itself works without AI credentials. For AI generation, connect a local Codex app/CLI signed in with your ChatGPT plan, or bring your own provider key.

## Features

- **AI that designs, not renders** — the agent works through editor tool calls, so its output is a normal project: every element it creates is selectable and editable, and you can revise a single screen with the magic-cursor action instead of regenerating everything.
- **Use your ChatGPT plan** — connect the Codex app or CLI to the hosted editor without giving Shotluma an API key.
- **Bring your own model** — also works with Moonshot, Google, Qwen, OpenAI, Anthropic, xAI, and OpenRouter; pick provider and model per run.
- **Full screenshot sets** — design a multi-screen story on portrait artboards, not one image at a time.
- **Direct manipulation** — typography, gradients, shapes, images, mockups, alignment, stacking, and spacing are all hand-editable, with or without AI.
- **Perspective device mockups** — drop a raw screenshot into a device frame with correct 3D geometry.
- **Local-first** — projects and uploads are stored in IndexedDB in your browser.
- **Store-ready export** — download the whole set as `1290 × 2796` or `1242 × 2688` PNGs in one ZIP.

## Refine one screen with AI

Select any artboard, describe the change, and let the AI agent revise just that screen. The result uses the same editor operations as the full-set generator and stays fully editable.

![Shotluma revising a single App Store screenshot with the AI editing action](docs/assets/demos/ai-screen-edit.gif)

## Quick start

Requires [Bun](https://bun.sh/) 1.3+ and a current desktop browser.

```bash
bun install
bun run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) and start editing.

## Using the editor

1. Start from a template or an empty screen.
2. Add text, device mockups, shapes, backgrounds, or uploads from the left sidebar.
3. Select an element to edit it; drag the handles to move, resize, or rotate.
4. Drop an uploaded PNG, JPG, or WebP anywhere on the canvas — or into a selected device frame.
5. Optionally use **Generate with AI** to create a set, or the magic-cursor action on a single screen to revise just that screen.
6. **Export all as ZIP** and pick a format.

Projects save automatically to the current browser profile. Clearing site data deletes them, so export anything important before wiping browser storage.

## Set up AI generation

The recommended hosted flow uses your ChatGPT plan and needs no API key:

1. Open [app.shotluma.com](https://app.shotluma.com), choose **Generate with AI**, select a Codex model, and click **Connect Codex**.
2. Click **Open in ChatGPT**. The desktop app opens a new local Codex chat with the setup prompt filled in; press **Send**. If the app is unavailable, copy the prompt and paste it into the Codex app or CLI instead.
3. Let Codex download and inspect Shotluma's small local connector. Return to the browser and click **Check connection**.
4. Keep using the hosted editor normally. You do not clone, build, or self-host Shotluma.

The connector listens only on `127.0.0.1`, accepts the exact paired Shotluma origin and a random browser pairing token, and delegates authentication to Codex App Server. It does not read or copy ChatGPT tokens. Codex must already be installed and signed in with ChatGPT on that computer. Stop it with the same runtime used during setup: `node ~/.local/share/shotluma/shotluma-codex-bridge.mjs stop` or `bun ~/.local/share/shotluma/shotluma-codex-bridge.mjs stop`.

Alternatively, enter a provider key in the generation dialog (**API keys** / **Enter API key**). Keys are stored unencrypted in this browser's `localStorage`. Use dedicated keys with restrictive quotas, and remove them before sharing the browser profile or device.

For local development you can still use `.env.local` as a fallback:

```bash
cp .env.example .env.local
```

```dotenv
VITE_MOONSHOT_API_KEY=
VITE_GOOGLE_GENERATIVE_AI_API_KEY=
VITE_ALIBABA_API_KEY=
VITE_OPENAI_API_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_XAI_API_KEY=
```

Restart the dev server after changing `.env.local` keys. Pick the provider and model in the generation dialog — models with configurable reasoning also expose their effort levels there. If a selected provider has no key, the dialog offers **Enter API key** and disables generation until one is saved.

How it works, and what to know:

- Codex runs go from the hosted browser to the paired loopback connector and then to Codex App Server. The connector exposes only the account, model, thread, turn, and Shotluma dynamic-tool RPC surface; Codex gets a read-only empty workspace with network access disabled.
- Google, Qwen, OpenAI, Anthropic, xAI, and OpenRouter are called directly from the browser via the AI SDK. Moonshot works only on localhost through the local `/api/moonshot` CORS proxy.
- When you start a run, your description and selected screenshots are sent to the selected provider or through Codex. Normal editing, persistence, and export never call any AI service. Provider limits or charges may apply.
- Browser-stored keys are visible to same-origin JavaScript by design. Optional `VITE_*` keys are exposed only by the local dev server; production builds replace every provider env key with an empty value. Never commit `.env.local` (see [Self-hosting](#self-hosting)).
- Prompts can be written in any language; generated canvas copy and summaries are in English.

For debugging, set `SHOTLUMA_AI_LOGGING=true` in `.env.local` to write one JSON file per run to the git-ignored `ai-logs/` directory. Logs record provider, model, timing, visible model output, tool activity, and token usage — never prompt text, screenshots, or API keys.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the editor on port `4173` |
| `bun run typecheck` | Strict TypeScript checks |
| `bun run lint` | Typed ESLint, complexity, and dependency rules |
| `bun run structure` | Enforce stylesheet module boundaries |
| `bun run test` | Run the Vitest suite once |
| `bun run test:coverage` | Tests with coverage thresholds |
| `bun run build` | Type-check and build the production bundle |
| `bun run preview` | Serve the production bundle locally, including the Moonshot proxy |
| `bun run audit` | Check dependencies for known vulnerabilities |
| `bun run check` | All required local and CI quality gates |

Changes to rendering, export, or AI behavior also need manual verification in the browser — the automated suite doesn't cover pixels.

## Self-hosting

`bun run build` produces a static app in `dist/`, including the downloadable Codex connector at `codex/shotluma-codex-bridge.mjs`. Provider env values are stripped from the bundle, so it can be hosted as a static site while users connect Codex or supply their own direct-provider keys in the browser.

The official editor is deployed at `https://app.shotluma.com`. The marketing
site at `https://shotluma.com` is maintained and deployed separately; its source
and production configuration are not part of this repository.

Codex connection prompts pair against the deployment's own origin. Google, Qwen, OpenAI, Anthropic, xAI, and OpenRouter work with browser-entered keys. Moonshot
remains local-only; offering it on a hosted deployment requires an authenticated
proxy. A hosted workflow with shared credentials likewise needs a backend or
short-lived credential exchange.

## Architecture

Shotluma is a single-package React 19 + TypeScript + Vite + Tailwind CSS app.

```text
src/App.tsx              Application composition
src/app/                 Project lifecycle, app shell, and export
src/editor/              History, editor actions, keyboard, pure calculations
src/components/          Canvas, toolbars, sidebar, modal, and shadcn UI
src/ai/                  AI runner, tool groups, prompt, measurement, previews
src/mockups/             Device definitions and perspective geometry
src/persistence.ts       IndexedDB project storage
src/types.ts             Shared editor models
src/styles/              Base styles and shadcn theme layer
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers data flow, the export pipeline, AI safety boundaries, and extension points. Adding a device asset? Read the [mockup specification](src/mockups/README.md) first. Working with a coding agent? [AGENTS.md](AGENTS.md) has the rules it should follow.

## Contributing

The project is early, so there's plenty of room. If something is broken, fix it. If something is missing and you think others would want it too, add it. No need to ask first — a pull request is a fine way to start the conversation.

Bug reports, design improvements, docs fixes, and new device mockups count just as much as code. [CONTRIBUTING.md](CONTRIBUTING.md) has the setup and the conventions; the `good first issue` label is a good place to look if you'd like something already scoped. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

- Questions and help: [SUPPORT.md](SUPPORT.md)
- Security issues (privately, please): [SECURITY.md](SECURITY.md)
- Project roles and decisions: [GOVERNANCE.md](GOVERNANCE.md)

## License and trademarks

MIT — see [LICENSE](LICENSE). Asset-specific terms are in [ASSET_LICENSES.md](ASSET_LICENSES.md). The `"private": true` flag in `package.json` only prevents accidental npm publication; it doesn't restrict the license.

Apple, App Store, and iPhone are trademarks of Apple Inc. Shotluma is an independent project, not affiliated with or endorsed by Apple. You remain responsible for following platform and trademark guidelines when using device mockups.

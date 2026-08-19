# Shotluma agent instructions

Shotluma is a React 19, TypeScript, and Vite editor. Treat maintainability, user data, export accuracy, and secret handling as product behavior.

## Required workflow

1. Read this file and the linked rule documents relevant to the change.
2. Inspect nearby code, tests, and `git status` before editing. Preserve unrelated user changes.
3. Keep the change focused. Refactor an affected boundary first if the requested work would otherwise deepen a violation.
4. Add or update tests and documentation with the implementation.
5. Run `bun run check` before handing off. Do not hide failures with disabled rules or weaker thresholds.

Use Bun for all package and script operations. Never use npm or manually edit `bun.lock`.

## Commands

- `bun install` — install the locked dependencies.
- `bun run dev` — start the editor at `http://127.0.0.1:4173`.
- `bun run typecheck` — run strict TypeScript checks.
- `bun run lint` — run typed ESLint, architecture, and complexity rules.
- `bun run test` / `bun run test:coverage` — run the Vitest suite.
- `bun run build` — type-check and build the production bundle.
- `bun run check` — run every required local and CI quality gate.

## Non-negotiable rules

- Keep editor mutations immutable; undo/redo snapshots depend on it.
- This public repository owns only the editor. The production marketing site is maintained privately and deployed separately; never add its source, styles, assets, or production-only configuration here.
- Never commit secrets, private screenshots, unlicensed assets, PSD/PSB files, or generated `dist/`.
- AI provider keys are entered in the browser (stored in `localStorage`) with optional `.env.local` `VITE_*` fallback for local dev; Moonshot and OpenCode use a same-origin CORS proxy. Never commit `.env.local` or deploy a keyed build.
- Use shadcn/Base UI and Hugeicons for editor chrome. Do not add a parallel UI or token system.
- Update generated `src/components/ui/` files only with the shadcn CLI.
- Use Conventional Commit messages and keep commits independently coherent.

## Rulebook

- [Architecture and module boundaries](docs/agent-instructions/architecture.md)
- [TypeScript, naming, and implementation quality](docs/agent-instructions/code-quality.md)
- [Testing and verification](docs/agent-instructions/testing.md)
- [UI, styling, and assets](docs/agent-instructions/ui-and-assets.md)
- [AI generation invariants](docs/agent-instructions/ai-generation.md)
- [Workflow, security, and review](docs/agent-instructions/workflow.md)

For system behavior and data flow, also read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

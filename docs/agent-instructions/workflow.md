# Workflow, security, and review

## Before editing

- Read the relevant architecture, quality, testing, UI, or AI rule file.
- Inspect `git status`, nearby tests, public types, and all callers of a changed interface.
- Search for an existing abstraction before creating another.
- For a large feature, data-model change, dependency, or visual-system change, start with an issue and maintainer agreement.

Do not broaden a task through opportunistic rewrites. A prerequisite refactor is appropriate when it creates the boundary the requested change needs; commit it separately.

## Dependencies and generated files

- Use Bun and keep `bun.lock` synchronized.
- Add a dependency only when platform APIs and current dependencies cannot solve the problem cleanly.
- Prefer maintained, typed packages with compatible licenses and a narrow runtime footprint.
- Run `bun audit` after dependency changes.
- Keep the `overrides` entries on the lowest patched release; they exist only to replace versions that dependents still pin.
- The audit script ignores `GHSA-vfj7-8cjw-p6xm` (`braces`), which has no patched release upstream and only reaches the project through the shadcn CLI. Remove the ignore once `braces` publishes a fix.
- Do not remove the `@hono/node-server` override without testing shadcn add/apply, the build, and the audit.
- Do not edit `dist/`, coverage output, lockfile internals, or shadcn-generated source manually.

## Security and privacy

- Never commit credentials, `.env.local`, tokens, private screenshots, customer data, or provider responses.
- Treat `VITE_*` variables as public client data.
- Validate stored, uploaded, DOM, and provider data at its boundary.
- Avoid logging sensitive user content.
- Report vulnerabilities through `SECURITY.md`, not public issues.

## Verification and commits

- Run the narrowest relevant test while developing, then `bun run check`.
- Review `git diff --check`, the full diff, and `git status` before committing.
- Use Conventional Commits.
- Separate prerequisite refactors, behavior changes, tests/infrastructure, and documentation when each is independently coherent.
- Do not mix unrelated formatting or generated-file churn into a commit.

Pull requests must explain the problem, design choice, automated and manual verification, visual evidence for UI changes, asset licenses, and intentionally deferred work. CI must pass without exceptions.

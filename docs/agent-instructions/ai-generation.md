# AI generation invariants

## Prompt caching and cost optimization

Every step of a multi-step AI run re-reads the growing conversation history, so the input token count scales quadratically with the number of turns. Prompt caching converts most of that re-read cost into 90% discounted cache reads. The runner applies provider-specific cache routing:

- **Anthropic**: explicit `cacheControl` breakpoint on the last message, moved forward by `prepareStep` on each step (`src/ai/prompt-caching.ts`). Without this, Anthropic caches nothing and every step pays the full input price.
- **OpenAI**: per-run `promptCacheKey` in `providerOptions.openai` keeps every step of the tool loop on the same cache replica for reliable prefix matching. GPT-5.6 caches automatically with a 30-minute TTL; cache writes are billed at 1.25× but reads get the 90% discount.
- **Google Gemini**: implicit caching is automatic on 2.5+ models. No configuration needed; savings are passed through when request prefixes match.

The prompt in `src/ai/prompt.ts` instructs the model to batch independent tool calls in one turn (whole slide composition, repair rounds, final preview pass) rather than issuing calls one at a time. Batching directly reduces the number of turns and therefore the quadratic input token cost. Measurement boxes are rounded to one decimal (`src/ai/measure.ts`) to keep tool-result payloads compact across the accumulated history.

## Security and provider boundary

The browser uses the AI SDK's native Google, Alibaba/Qwen, OpenAI, Anthropic, and xAI providers directly. OpenRouter is called directly through the OpenAI chat provider against `https://openrouter.ai/api/v1`. Moonshot uses the OpenAI chat provider through the local `/api/moonshot` CORS proxy.

Codex is a separate no-API-key transport for hosted users. The browser pairs with `scripts/shotluma-codex-bridge.ts` on `127.0.0.1`; that process launches `codex app-server` over stdio and uses Codex's existing ChatGPT authentication. The user stays on `app.shotluma.com` and never needs a repository checkout or local Vite server.

- Provider keys are entered in the browser (AI generate modal → API keys) and stored unencrypted in `localStorage` under `shotluma-ai-provider-keys`. Optional `.env.local` `VITE_*` values work only through the local dev server and merge underneath browser keys. Production builds must replace every provider env value with an empty string.
- Keep Codex pairing separate from provider keys. The browser stores only the exact app origin and a random pairing token under `shotluma-codex-connection`; the bridge stores the match with mode `0600`. Neither side may read, copy, expose, or persist Codex/ChatGPT access tokens.
- The bridge must remain loopback-only, require exact-origin CORS plus the bearer pairing token, and allowlist its App Server RPC surface. Force all threads and turns into the dedicated empty, read-only workspace with approvals disabled and network denied. Do not expose shell, filesystem, MCP, skill, plugin, or arbitrary App Server methods.
- Keep Codex threads ephemeral and delete them after every run. Execute App Server dynamic tool calls only through `createEditorTools`, preserving generate/edit scoping, abort behavior, one-step undo, and normal tool validation.
- Map Codex `item/reasoning/summaryPartAdded` and `summaryIndex` changes to explicit narration boundaries before forwarding summary deltas. The run band is plain text: strip provider Markdown at its rendering boundary so streamed Codex summaries use the same sentence queue and visual treatment as direct-provider reasoning.
- `scripts/codex-bridge-asset-plugin.ts` must emit the reviewed connector source at `/codex/shotluma-codex-bridge.mjs` in both development and production builds. The copied setup prompt must use the current browser origin so normal hosted and self-hosted deployments pair only with themselves.
- Open the ChatGPT desktop app with the documented `codex://threads/new?prompt=` deep link and URI-encode the complete setup prompt. Deep links prefill but do not submit the composer, so the tutorial must tell the user to press Send and retain the manual copy fallback.
- Keys are intentionally visible to same-origin browser JavaScript. Never commit `.env.local`, reuse a shared production credential, or weaken the production build boundary. Recommend dedicated keys with restrictive quotas.
- Do not add a proxy for providers whose browser API supports the required CORS flow. Moonshot is available only on localhost through `/api/moonshot`; a hosted deployment that offers Moonshot or must hide keys needs a separate authenticated backend design.
- Never return secrets or raw data URLs in model-visible state.
- Keep uploads browser-local except for screenshots and app logos explicitly included in an AI run.
- In generate mode, collect app name and app logo separately from the app description and screenshots. Pass the name and logo asset id through the user message, attach the logo image, and instruct the model to place the logo with `add_image` (never as a device screenshot).
- Keep developer AI run logging gated by `SHOTLUMA_AI_LOGGING` and write only
  through the local Vite middleware to the git-ignored `ai-logs/` directory.
  Persist only the versioned, bounded log schema: never add input prompt text,
  screenshot payloads or names, credentials, or raw provider metadata.

## Tool architecture

The model mutates the editor only through the tools composed by `src/ai/tools.ts`.

- Tool groups validate with Zod and delegate mutations to `AiEditorController`.
- Clamp every numeric model input to the editor range.
- Return `{ ok: false, error }` for expected failures; do not throw.
- Keep Zod descriptions accurate because they are model-facing API documentation.
- Add new element fields to the type, defaults, renderer, controller whitelist, and `update_element` as applicable.
- Emit `AiToolActivity` for visible mutations.
- Return real DOM measurements after element mutations.
- Icons: the model places Hugeicons via `add_icon` and updates them via `update_element` (fields: `icon`, `color`, `strokeWidth`, `shadow`). The curated icon library lives in `src/icons.ts`. The model must NEVER use emoji characters on canvas; always use `add_icon` instead.
- Keep `inspect_slide` and `render_slide_preview` as the visual correction loop.
- Keep edit mode scoped to its target slide.
- `declare_plan` is the one generate-mode tool that mutates nothing: it reports the intended screen set to the run band before the first `add_slide`. Keep it out of edit mode, and keep it advisory — never gate slide creation on it.
- Overlay assets (opt-in via the generate modal): `create_overlay_asset` calls OpenAI `gpt-image-2` through the AI SDK `generateImage` API and registers the result with `AiEditorController.addAsset`. Because `gpt-image-2` cannot emit transparency, generation always uses a flat `#FF00FF` chroma-key backdrop (`src/ai/overlay-asset-prompt.ts`). `remove_asset_background` then strips that key in-browser via Canvas (`src/ai/remove-chroma-key-background.ts`, pure pixel math in `src/ai/chroma-key.ts`) and registers a transparent PNG. The key color is measured per image with `detectChromaKey` rather than assumed to be `#FF00FF` — the model only approximates the requested backdrop, and keying against the nominal color leaves the whole background half-transparent (a pink haze). Keep the ramp wide, keep the despill pass, and keep reporting `backgroundCleared` so a failed key is visible instead of silently shipping a hazy asset. Do not use these tools for mockups, device frames, or full screens — only cutout elements placed with `add_image`. Require a resolved OpenAI key (browser storage or local-dev `VITE_OPENAI_API_KEY`) even when the chat model uses another provider. Never log generated image payloads.
- Overlay generation is budgeted: `OVERLAY_ASSET_BUDGET` in `src/ai/overlay-asset-prompt.ts` caps `create_overlay_asset` calls per run, counted per `createOverlayAssetTools` instance and consumed by failed attempts too, so a retry loop cannot burn the OpenAI key. The prompt section in `src/ai/prompt.ts` and the tool descriptions must keep stating the same number — read it from the constant rather than hardcoding it.

## Editor integration

The controller adapter must update `slidesRef` synchronously before React state because multiple tool calls can read and write in one tick. Preserve the non-history adapter and create one checkpoint before a run so the entire generation remains one undo step.

Clear selection before generation and preview capture. Any live overlay must carry `data-ai-overlay` and remain filtered from preview and export.

## Canvas and prompt contract

- Coordinates and widths are percentages of the `1290 × 2796` canvas.
- Text `fontSize` is CSS pixels on the internal 330 px-wide DOM artboard.
- Hero: `32–46`; sub-headline: `18–24`; body: `13–17`; label: `9–12`.
- Values above roughly `52` are usually a four-times sizing error.
- Keep these values identical in `prompt.ts`, schemas, tool descriptions, and documentation.
- Keep loaded font names aligned with `src/main.tsx`.
- Keep the prompt's repair-round limit aligned with preview behavior.
- Keep AI-generated canvas copy and completion summaries in English, regardless of the language used in the request.

Rich text comes from structured highlights through `src/ai/richtext.ts`. The model never writes raw HTML. `sanitizeRichText` remains the final whitelist.

Canvas copy from `add_text` / `update_element` passes through `normalizeAiCopy` (`src/ai/normalize-copy.ts`) so double-escaped `\n` sequences become real line breaks before they hit the element. Do not rely on a preview repair round for that.

The stream runner reports errors and aborts as events instead of rejecting. Preserve visible reasoning progress for long-running reasoning models.

## Run band

While a run is live, the editor shows `src/components/AiRunBand.tsx` — a floating band over the canvas, not the shrunken generate dialog. The band owns three invariants:

- **Prose over tool calls.** Assistant text is the backbone and reasoning fills the gaps between its sentences, both at reading size. Tool calls appear only as a count. Do not reintroduce a visible tool log: repeated `update_element` lines crowd out the one thing the canvas cannot show, which is why the model made a choice.
- **Sentences, not character windows.** `src/ai/run-narration.ts` accumulates both streams into whole sentences and keeps the last `VISIBLE_SENTENCE_COUNT`, so the band never grows a scroll area and two steps never collide into one line. Slicing a raw character window instead reproduces the mid-sentence truncation this replaced.
- **The plan is advisory.** `declare_plan` (`src/ai/plan-tool.ts`) reports intent only; it creates nothing. `reconcilePlan` in `src/ai/run-plan.ts` projects it onto the screens actually built, appends unplanned ones, and always keeps an in-progress entry while the run is live. A run that builds more or fewer screens than announced must not make the rail claim it finished early.

In edit mode there is one target screen and no plan, so the rail is omitted and the band renders narrow. The run band is also the result and error surface — a finished run stays in place instead of handing back to the centered dialog.

Reasoning-effort choices belong to the model catalog. Offer only values supported by the selected model (never a provider-default option) and default to `high` when the model supports it, otherwise `medium`. Pass portable efforts through the AI SDK's top-level `reasoning` option. OpenAI GPT-5.6 (Luna/Terra/Sol) and Moonshot/Kimi K3 also offer `max`, which the runner sends via OpenAI-compat `providerOptions.openai.reasoningEffort` because the shared SDK option has no `max`. Do not duplicate provider-specific effort mapping in the UI. The generate modal exposes one model picker grouped by provider; reasoning effort appears as secondary chips only when the selected model supports it.

Reasoning **visibility** is a separate switch from reasoning **effort**, and providers are asymmetric about it. OpenAI's Responses API defaults `reasoningSummary` to `'detailed'` as soon as an effort is set, so thoughts stream without being asked for. Google does not: in `@ai-sdk/google`, `thinkingLevel` and `thinkingBudget` fall back to the mapped top-level `reasoning` value, but `includeThoughts` reads *only* from `providerOptions.google.thinkingConfig` with no fallback. Omit it and Gemini still thinks and still bills the tokens while withholding every thought summary — the run band stays empty for the whole run. `buildStreamRequestOptions` (`src/ai/prompt-caching.ts`) therefore always sends `thinkingConfig: { includeThoughts: true }` for Google, across all Gemini generations (the `thinkingLevel`/`thinkingBudget` split is generation-specific; `includeThoughts` is not). Keep that object limited to `includeThoughts`: adding `thinkingLevel` or `thinkingBudget` there would take full precedence over the portable `reasoning` option and silently discard the user's effort choice.

This matters more than a missing nicety because `prompt.ts` tells the model not to narrate its work turn by turn. Reasoning is therefore the only live prose during a run, and for a model that streams none, the tool-activity line in the run band is the only remaining signal — it is load-bearing, not decoration.

OpenRouter is the only provider with a runtime model catalog (`src/ai/openrouter-models.ts`): the public `/models` endpoint is fetched without a key, filtered to models that accept image input and support tool calling — both are hard requirements for a Shotluma run — and cached in `localStorage` for an hour. Loaded models are registered with `setDynamicOpenRouterModels` so catalog lookups resolve them; unknown OpenRouter ids synthesize a minimal option instead of throwing, while every other provider keeps failing fast on unknown models. Keep the curated OpenRouter shortlist in `provider-catalog.ts` working as the fetch fallback, keep the vision+tools filter intact, and offer reasoning effort only when the fetched model advertises the `reasoning` parameter.

# Handoff — 2026-06-12 — Claude AI provider setup

Format follows `COLLABORATION.md → Handoff Format`. Intended audience: Codex (for review + push).

---

## Current status

Real OpenAI and Anthropic providers are wired in behind the existing `ModelProvider` interface,
gated by a per-provider approval flag and a master *Local-only mode* kill switch. Defaults are
unchanged: `mock` is the active provider, both cloud providers are NOT approved, local-only mode
is ON, memory sharing is OFF. None of these flips happen without explicit user action via the new
**Settings → AI Provider** screen. Cloud approval, revocation, selection, and every cloud call or
block writes to the existing audit log.

Tests have NOT been executed on this PC (per the existing local-no-install policy from the
2026-06-10 Codex handoff — `node_modules/` is empty). They are designed to run in GitHub Actions
on the existing CI workflow. The new vitest suite is `packages/core/src/__tests__/providers.test.ts`.

The git working tree is clean against `main` at `47f3acc` and has uncommitted edits ready for
review. Nothing has been committed or pushed.

---

## Files changed

### Created (8)

- `packages/core/src/providers/errors.ts` — `MissingApiKeyError`, `CloudNotApprovedError`,
  `LocalOnlyModeBlockedError`, `ProviderHttpError`.
- `packages/core/src/providers/openai.ts` — `OpenAIProvider` (Chat Completions, default
  `gpt-4o-mini`). Construction never throws; missing key surfaces at `complete()` time.
- `packages/core/src/providers/anthropic.ts` — `AnthropicProvider` (Messages API, default
  `claude-haiku-4-5-20251001`). Same construction/error semantics as the OpenAI adapter.
- `packages/core/src/providers/settings-store.ts` — `ProviderSettingsStore` (SQLite-backed
  key/value: selected provider, per-provider `cloud_approved`, `local_only_mode`,
  `memory_sharing`).
- `packages/core/src/providers/managed.ts` — `ManagedProvider`. Single `ModelProvider` the
  orchestrator talks to. Refuses cloud calls unless approved + local-only off. Writes audit on
  every block, call, and error.
- `packages/core/src/__tests__/providers.test.ts` — vitest suite covering defaults, not-approved
  block, local-only block, success path, missing-api-key (no network call), audit trail, and
  memory-not-sent guarantees.
- `apps/desktop/src/renderer/src/pages/Providers.tsx` — new settings screen with provider radio,
  key-detected/missing indicator, data-sent notice in a `ConfirmationModal`, local-only and
  memory-sharing toggles, revoke-approval button.
- `docs/handoffs/2026-06-12-claude-ai-provider.md` — this file.

### Modified (10)

- `packages/core/src/db/schema.ts` — added `provider_settings (key, value, updated_at)` table.
  `IF NOT EXISTS` so existing DBs upgrade silently.
- `packages/core/src/providers/types.ts` — added `ProviderId`, `requiresApproval`, `apiOrigin`,
  `apiKeyEnvVar`, optional `hasApiKey()`.
- `packages/core/src/providers/mock.ts` — added `requiresApproval: false` and `hasApiKey()`.
- `packages/core/src/providers/index.ts` — re-export the new modules.
- `packages/core/src/agent/orchestrator.ts` — `localOnlyMode` now accepts `boolean | (() =>
  boolean)`; added optional `memorySharing` flag (default false). Audit `chat.turn` records both.
- `apps/desktop/src/main/services.ts` — removed the hardcoded `localOnlyMode = true`. Reads
  `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` from `process.env`. Builds the `ManagedProvider` and
  injects getter functions into the orchestrator so live toggles take effect immediately.
- `apps/desktop/src/main/ipc.ts` — new channels (`provider:list`, `provider:settings`,
  `provider:select`, `provider:approveCloud`, `provider:revokeCloud`, `provider:setLocalOnly`,
  `provider:setMemorySharing`). `agent:turn` wraps the orchestrator call so provider errors
  surface as `{ ok: false, providerError: { code, message } }` instead of crashing the renderer.
  Bootstrap now returns `providerSettings.snapshot()`.
- `apps/desktop/src/preload/index.ts` — exposed the new `assistant.provider.*` API.
- `apps/desktop/src/renderer/src/api.ts` — mirror declaration of the new `provider` API shape.
- `apps/desktop/src/renderer/src/components/Sidebar.tsx` — added the *AI Provider* nav item.
- `apps/desktop/src/renderer/src/App.tsx` — wired the new screen + extended the `Bootstrap` type.
- `apps/desktop/src/renderer/src/pages/Chat.tsx` — handles `providerError` codes
  (`not_approved`, `local_only_mode`, `missing_api_key`) with actionable nudges.
- `README.md` — new **AI provider setup** section explaining the env-var + approval flow.
- `CHANGELOG.md` — new 2026-06-12 entry.

---

## Decisions made

1. **API keys live in `process.env` only.** The app does not write keys to disk in this pass —
   not in the SQLite store, not in a settings file. If a user wants in-app key entry, the next
   pass should write to `safeStorage` (OS keychain), never to plaintext.
2. **`ManagedProvider` is the sole `ModelProvider` the orchestrator sees.** It looks up the
   inner provider on every call via `ProviderSettingsStore.selectedProvider()`, which makes
   toggles take effect immediately without rebuilding the orchestrator.
3. **Two-step gate.** Cloud provider selection alone is NOT enough — local-only mode is a
   separate, intentional second step. Approving a provider does not auto-disable local-only.
   This is by design: the kill switch should be flippable independently of approvals.
4. **Construction never throws on missing keys.** Both `OpenAIProvider` and `AnthropicProvider`
   take `apiKey: string | undefined` and only raise `MissingApiKeyError` at `complete()` time.
   Lets the UI render the provider list with a "missing" indicator regardless of env state.
5. **Cloud calls are audited at the gate, not inside each provider.** Approval, revocation,
   selection, every block, every call, and every error are recorded with `provider.*` action
   names. No need to thread the audit service through individual provider adapters.
6. **Memory is never sent by default.** The orchestrator does not currently inject memory into
   prompts at all, but a `memorySharing` flag exists so a future change can opt in safely. A
   pinned test guards this — any change that unconditionally sends memory will fail.
7. **Schema migration via `IF NOT EXISTS`.** The new `provider_settings` table is added without
   bumping `SCHEMA_VERSION`. Existing dev DBs upgrade silently. No migration script needed.
8. **`agent:turn` IPC response shape changed.** It now returns `{ ok: boolean, reply?, ... ,
   providerError? }` instead of the previous bare `{ reply, ... }`. The Chat screen handles
   both shapes by checking `r.ok` first. If any other code calls `agent:turn` (e.g. background
   worker), it needs the same update.
9. **Default model ids.** OpenAI: `gpt-4o-mini` (low cost, fast). Anthropic:
   `claude-haiku-4-5-20251001` (small, fast, current). Override via constructor (no UI yet).
10. **CSP unchanged.** `connect-src 'self'` is correct because the cloud HTTP calls run in the
    main process, not the renderer. Do NOT add wildcards.

---

## Open TODOs

- [ ] `npm install && npm test` on CI to verify the new vitest suite + existing suites green.
- [ ] Run `npm run dev` end-to-end:
  - Default → Chat with mock works; provider banner shows "Local Mock".
  - Switch to OpenAI without key → confirmation modal → approve → switch local-only off →
    chat returns `Provider error (missing_api_key): ... Set the API key environment variable...`.
  - Set the env var → restart → chat works.
- [ ] Decide on in-app key entry (current: env-only). If yes, write a `safeStorage`-backed key
  store and a separate Settings UI under AI Provider.
- [ ] Model-id picker UI (currently constructor-only).
- [ ] Map provider tool-use responses to the existing `ToolPlan` flow so cloud chat can also
  propose `pending.scan` etc. — must not bypass the confirmation modal.
- [ ] Background worker eventually needs the same `agent:turn` response-shape update if it
  ever calls into the chat path.

---

## Risks / blockers

- **TypeScript may or may not flag `services.providerRegistry[id]` under
  `noUncheckedIndexedAccess`.** `Record<ProviderId, ModelProvider>` indexed with `id: ProviderId`
  *should* return a non-undefined `ModelProvider` because the keys match the union exactly, but
  if CI fails on this, the fix is a single non-null assertion (`!`) at each access site in
  `apps/desktop/src/main/ipc.ts`.
- **Anthropic model id `claude-haiku-4-5-20251001` is current as of January 2026.** If the API
  rejects it, swap the default in `packages/core/src/providers/anthropic.ts` constructor.
- **Cloud chat is conversation-only.** Until tool-use plumbing is added, asking a cloud
  provider "find pending replies" returns prose, not a `ToolPlan`. The MockProvider still
  proposes tools, so the existing flow is exercised when the user is on `mock`.
- **No live test against real APIs.** The new vitest suite stubs `fetch` and never reaches the
  network. A separate manual smoke test with a real key is needed before declaring "works".
- **`agent:turn` response-shape change is a contract break.** The renderer was updated, but any
  future code calling that channel must read `ok` first.

---

## Suggested next step

1. **Codex:** review the diff (~14 changed/created files), commit, push, watch GitHub Actions.
   The vitest suite is the canonical check — if it goes green, the gate semantics work.
2. After CI green, do a **manual smoke test**: launch the app, walk through the AI Provider
   screen, confirm the audit screen shows the approve/select/block events as expected.
3. With a real `ANTHROPIC_API_KEY` set, send a chat — expect a non-mock reply and a
   `provider.cloud.call` row in the audit log.
4. Then pick ONE next pass:
   - **In-app API-key entry via `safeStorage`** (closes the "env-only" risk).
   - **Cloud tool-use** (wire Anthropic's `tools` / OpenAI `tools` to the existing `ToolPlan`).
   - **Setup wizard** (still pending from the 2026-06-10 handoff) — would naturally include the
     new AI Provider step.

Do not remove or soften the approval gate, the local-only toggle, the audit calls, or the
memory-not-sent guarantee. They are load-bearing.

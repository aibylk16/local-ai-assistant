# Changelog

Use this file to record every meaningful project change so Codex, Claude, and the user can stay aligned.

## 2026-06-10

- Created initial local-first desktop AI assistant project pack.
- Defined target platforms: Windows and macOS only, no mobile app.
- Added MVP scope for text input, voice input, voice output, background tray mode, permission center, local memory, audit log, email monitoring, and WhatsApp connector boundaries.
- Added privacy rules: no silent actions, no hidden monitoring, no sharing user data without permission, local encrypted memory, user-controlled memory deletion/export.
- Added high-risk confirmation rules for sending messages/emails, deleting files, purchases/payments, software installs, OS setting changes, and external data sharing.
- Added WhatsApp reality check: personal WhatsApp full-chat reading has no stable official public API; use WhatsApp Business API, manual import, or explicit opt-in desktop observation.
- Added Claude build prompt for generating the working MVP.

### Implementation pass — MVP scaffold (by Claude)

**What changed**

- Scaffolded the npm workspaces monorepo (`package.json`, `tsconfig.base.json`, `.gitignore`, `vitest.config.ts`).
- Built `packages/core` with `PermissionEngine`, `AuditLogService`, `MemoryService` (encrypted at rest via an `EncryptionAdapter`), `ToolRegistry`, `ModelProvider` interface + `MockProvider`, and `AgentOrchestrator`. `applySchema` provisions the SQLite tables for permissions, audit, memory, tasks, connector accounts, message threads, and pending actions.
- Built `packages/connectors`:
  - Email: `EmailConnector` interface, `MockEmailConnector` with fixtures, placeholder `Gmail` / `Graph` / `Imap` adapters (each file documents what's needed to finish it), and `PendingReplyDetector` (heuristic, no LLM).
  - WhatsApp: `WhatsAppAdapter` interface + three placeholders — `BusinessCloudAdapter`, `ManualImportAdapter`, `DesktopObservationAdapter` (disabled by default; requires `screen.observe` + `accessibility`).
  - Browser: `BrowserConnector` interface + `PlaywrightConnector` placeholder.
  - Filesystem: `LocalFilesystemConnector` that refuses to overwrite existing files without explicit confirmation.
- Built `packages/background-worker` with `BackgroundWorker` — opt-in (checks `background.monitoring`), pausable, visible (drives the tray badge), audited (every cycle writes to the audit log).
- Built `apps/desktop` (Electron + React + TypeScript via `electron-vite`):
  - Main process: `index.ts`, `db.ts` (better-sqlite3 + `SafeStorageAdapter` for OS keychain encryption), `services.ts` (single root services registry), `ipc.ts` (every channel re-checks permissions), `tray.ts` (visible monitoring indicator + Pause/Resume).
  - Preload: contextBridge exposing a tightly scoped `assistant.*` API. `contextIsolation: true`, `nodeIntegration: false`.
  - Renderer: 8 screens — Chat, Voice, Permissions, Memory, Audit, Connectors, Monitoring, Pending — plus `ConfirmationModal` and `Sidebar`.
- Added vitest suites: `permissions.test.ts` (defaults off, grant/revoke, `require` throws, orchestrator refuses without permission, `turn()` never executes) and `memory.test.ts` (sensitive-data block, manual override, upsert, delete/deleteAll).
- Added README "Setup" section with Windows + macOS instructions, native-deps notes (`better-sqlite3` rebuild), and pointers for swapping in real Gmail / Outlook / WhatsApp Business / Claude / OpenAI providers.

**Why it changed**

The repo previously held the spec docs and an outline `package.json` only. This pass turns the spec into a working scaffold that, after `npm install`, can run via `npm run dev` and exercise the full chat → permission → tool → audit → memory flow with the offline `MockProvider`.

**TODOs / known risks**

- `better-sqlite3` is a native module. After `npm install`, run `npm run rebuild:native` to rebuild it against the Electron ABI, otherwise the main process crashes on startup.
- Tray icon currently uses an empty 1x1 native image — replace with a real PNG under `apps/desktop/resources/` before shipping.
- Voice screen uses the Web Speech API (Chromium-backed). It works in dev but is online-bound on some platforms — swap in a local Whisper backend if you need fully offline STT.
- All non-mock connectors (Gmail, Graph, IMAP, WhatsApp Business, Playwright) are placeholders that throw with a "not implemented yet" message and inline docs. They are intentional adapter slots, not stubs to be silently bypassed.
- Desktop observation adapter does NOT yet wire up macOS AX or Windows UIA — it just refuses politely. Implement only with a visible monitoring badge and per-cycle audit entries.
- The MVP runs `MockProvider` only — `LOCAL_ONLY_MODE` is hardcoded `true` in `services.ts`. Wire up Anthropic/OpenAI providers behind the existing `ModelProvider` interface; the UI will need a "what data may be sent" confirmation before any cloud call.
- CSP in `renderer/index.html` is strict (`default-src 'self'`) — when adding a cloud provider, add an explicit `connect-src` entry for that provider's API origin, not a wildcard.

### GitHub CI setup (by Codex)

**What changed**

- Added `.github/workflows/ci.yml` to install dependencies, rebuild Electron native modules, run tests, and build the app on GitHub-hosted Windows and macOS runners.
- Added `docs/github-install.md` with instructions for running installation and verification on GitHub instead of the local PC.
- Added `docs/handoffs/2026-06-10-codex-github-ci.md` to document the handoff and current limitations.

**Why it changed**

The user asked not to install dependencies on this PC and to install/check the project on GitHub instead. The workflow moves dependency installation and scaffold verification to GitHub Actions.

**TODOs / known risks**

- This local folder is not currently connected to a GitHub repository, and GitHub CLI is not installed here.
- A push was attempted to `https://github.com/aibylk16/local-ai-assistant.git`, but GitHub returned `Repository not found.`
- The GitHub workflow has not run yet; actual install/test/build status remains pending until the project is pushed or uploaded to GitHub.
- The workflow uses `npm install` because no `package-lock.json` is committed yet. Once a trusted environment produces a lockfile, commit it and switch CI to `npm ci`.

### GitHub CI test fix (by Codex)

**What changed**

- Updated the JWT sensitive-data regex in `packages/core/src/memory/encryption.ts` so normal JWT-shaped bearer tokens are blocked by `looksSensitive`.

**Why it changed**

GitHub Actions failed on both Windows and macOS in `packages/core/src/__tests__/memory.test.ts > looksSensitive > flags OTPs and JWTs`. The test JWT had a valid JWT shape, but the first segment was shorter than the detector required, so the detector returned `false`.

**TODOs / known risks**

- Re-run GitHub Actions after pushing this fix.

## 2026-06-12

### Online web preview + GitHub Pages workflow (by Codex)

**Files changed**

- `apps/web/*`
- `.github/workflows/deploy-web.yml`
- `README.md`
- `docs/handoffs/2026-06-12-codex-web-preview.md`
- `CHANGELOG.md`

**What changed**

- Added a lightweight React/Vite web companion app for online browser access.
- Added custom assistant identity fields, wake phrase preview, voice-style selection, provider safety toggles, and mock chat.
- Added a GitHub Pages deployment workflow named `Deploy Web Assistant`.
- Documented that the web app is an online companion and that local computer control still belongs to the desktop companion.

**Why it changed**

The user wants an online version so they do not need to download a new Windows runner for every test. GitHub Pages is the fastest safe path to an always-available browser preview without adding a backend or hosting account.

**TODOs / known risks**

- GitHub Pages may need to be enabled in repository settings with GitHub Actions as the source.
- Private repository Pages availability depends on the GitHub account/plan.
- This web preview is mock-only and cannot perform local Windows/Mac automation.

### Windows app artifact workflow (by Codex)

**Files changed**

- `.github/workflows/build-windows-app.yml`
- `README.md`
- `docs/handoffs/2026-06-12-codex-windows-artifact.md`
- `CHANGELOG.md`

**What changed**

- Added a GitHub Actions workflow that installs dependencies, rebuilds native Electron modules, runs tests, packages the Windows desktop app, and uploads the release output as `local-ai-assistant-windows`.
- Added README instructions for testing without local install by downloading the GitHub Actions artifact.
- Added a handoff documenting the workflow, decisions, TODOs, and risks.

**Why it changed**

The user wanted the best way to test without installing project dependencies locally. Building a Windows app artifact on GitHub lets the user download and run the app while keeping install/build work in CI.

**TODOs / known risks**

- Push the workflow and verify the GitHub Actions packaging run.
- The Windows app artifact is unsigned, so Windows may show a warning before opening.
- Packaging may reveal Electron Builder issues that the normal build workflow does not catch.

### Windows packaging metadata fix (by Codex)

**Files changed**

- `apps/desktop/package.json`
- `CHANGELOG.md`

**What changed**

- Pinned Electron to `31.0.0` instead of `^31.0.0`.
- Added `build.electronVersion: "31.0.0"` so Electron Builder can package in GitHub Actions.
- Added package `description` and `author` metadata for Electron Builder.

**Why it changed**

The `Build Windows App Artifact` workflow failed during `Package Windows app` because Electron Builder could not compute the Electron version from installed modules when the project declared Electron as a non-fixed range.

**TODOs / known risks**

- Re-run the Windows artifact workflow after pushing this fix.

### Windows runnable artifact workflow fix (by Codex)

**Files changed**

- `.github/workflows/build-windows-app.yml`
- `README.md`
- `CHANGELOG.md`

**What changed**

- Changed the Windows artifact workflow from Electron Builder installer packaging to a GitHub-built runnable bundle.
- The workflow now installs dependencies, rebuilds native modules, runs tests, builds the app, copies source plus `node_modules` into `windows-runner`, and uploads `local-ai-assistant-windows-runner`.
- Added `START_LOCAL_AI_ASSISTANT.cmd` generation inside the artifact so the user can launch without local `npm install`.
- Updated README artifact instructions.

**Why it changed**

Electron Builder failed in GitHub Actions while packaging NSIS because `7zip-bin` was not found in the expected workspace path. The runnable bundle avoids installer packaging for now while still letting the user test the app without local dependency installation.

**TODOs / known risks**

- Re-run the artifact workflow and download `local-ai-assistant-windows-runner` if it passes.
- The downloaded bundle still requires Node.js on the PC.
- Later, revisit proper signed installer packaging after the app MVP is stable.

### Windows runner hidden-bin fix (by Codex)

**Files changed**

- `.github/workflows/build-windows-app.yml`
- `README.md`
- `CHANGELOG.md`

**What changed**

- Added `include-hidden-files: true` to the artifact upload so `node_modules/.bin` command shims are included.
- Added a launcher guard that clearly reports when `node_modules/.bin/electron-vite.cmd` is missing from the downloaded artifact.
- Added README troubleshooting note for the `electron-vite is not recognized` error.

**Why it changed**

The first runnable artifact downloaded successfully but failed locally because `electron-vite` was not found. GitHub artifact upload skipped hidden paths by default, which removed the `.bin` command shims required by npm workspace scripts.

**TODOs / known risks**

- Push this fix, wait for a new green artifact run, then download the new `local-ai-assistant-windows-runner`.

### Real AI provider setup behind local-only safety (by Claude)

**Files changed**

- `packages/core/src/db/schema.ts` — added `provider_settings` key/value table.
- `packages/core/src/providers/` — new files:
  - `errors.ts` (`MissingApiKeyError`, `CloudNotApprovedError`, `LocalOnlyModeBlockedError`, `ProviderHttpError`)
  - `openai.ts` (`OpenAIProvider`, model default `gpt-4o-mini`, never throws in constructor)
  - `anthropic.ts` (`AnthropicProvider`, model default `claude-haiku-4-5-20251001`)
  - `settings-store.ts` (`ProviderSettingsStore`: selected provider, per-provider cloud-approval flag, local-only toggle, memory-sharing toggle — all SQLite-persisted)
  - `managed.ts` (`ManagedProvider`: the only `ModelProvider` the orchestrator talks to — enforces approval + local-only at every call, writes audit on block/call/error)
- `packages/core/src/providers/types.ts` — added `ProviderId`, `requiresApproval`, `apiOrigin`, `apiKeyEnvVar`, optional `hasApiKey()`.
- `packages/core/src/providers/mock.ts` — added `requiresApproval: false` and `hasApiKey(): true`.
- `packages/core/src/agent/orchestrator.ts` — `localOnlyMode` now accepts `boolean | (() => boolean)`; added `memorySharing` option (default false); audit `chat.turn` records both flags.
- `packages/core/src/__tests__/providers.test.ts` — new vitest suite covering: defaults, cloud blocked without approval, cloud blocked under local-only, success after both, `MissingApiKeyError` never reaches network, audit trail for approve/revoke, and memory-not-sent guarantees.
- `apps/desktop/src/main/services.ts` — builds the three-provider registry from env-var keys, wraps with `ManagedProvider`, hands the orchestrator getter functions for local-only and memory-sharing.
- `apps/desktop/src/main/ipc.ts` — new channels: `provider:list`, `provider:settings`, `provider:select`, `provider:approveCloud`, `provider:revokeCloud`, `provider:setLocalOnly`, `provider:setMemorySharing`. `agent:turn` now returns `{ ok, providerError? }` so cloud errors surface in the UI instead of crashing the renderer.
- `apps/desktop/src/preload/index.ts` + `apps/desktop/src/renderer/src/api.ts` — exposed the new channels.
- `apps/desktop/src/renderer/src/components/Sidebar.tsx` — added the *AI Provider* item.
- `apps/desktop/src/renderer/src/App.tsx` — bootstrap now includes `providerSettings`; routes `providers` screen.
- `apps/desktop/src/renderer/src/pages/Providers.tsx` — new screen with provider radio, key-detected indicator, data-sent notice, confirmation modal before approval, *Local-only mode* and *Share memory* toggles, *Revoke approval* button.
- `apps/desktop/src/renderer/src/pages/Chat.tsx` — handles `providerError` codes (`not_approved`, `local_only_mode`, `missing_api_key`) with actionable nudges to the AI Provider screen.
- `README.md` — new *AI provider setup* section with env-var instructions and the approval flow.
- `docs/handoffs/2026-06-12-claude-ai-provider.md` — handoff for Codex.

**Why it changed**

The MVP previously hardcoded `localOnlyMode = true` and ran the `MockProvider` only. This pass
implements the OpenAI and Anthropic adapters behind the same `ModelProvider` interface, behind a
mandatory approval gate. Selecting a cloud provider is harmless on its own — calls still fail
closed until (a) the user explicitly approves the data-sent notice (recorded as
`provider.cloud.approve` in the audit log) AND (b) the user explicitly turns off Local-only mode.
Memory items are never appended to the prompt unless the user opts into sharing.

**TODOs / known risks**

- API keys are read from `process.env` at startup only. If the user wants in-app key entry, the
  next pass should add a Settings UI that writes to `safeStorage` (do NOT add a plain-text
  settings file). Surface the keychain failure path explicitly.
- The CSP in `renderer/index.html` is `connect-src 'self'`, which is correct because the network
  calls happen in the main process. Do not loosen it.
- `gpt-4o-mini` and `claude-haiku-4-5-20251001` are the model defaults. If a future model id
  diverges, surface the override (currently constructor-only) in the UI.
- Cloud providers currently never propose tools (`suggestedTool` is always undefined), so cloud
  chat is conversation-only. A future pass should map provider tool-use to the
  `ToolPlan` / `ConfirmationModal` flow without bypassing the permission engine.
- Memory injection is not wired in even when `memorySharing` is true — the flag exists so any
  future code path that injects memory MUST honor it. The test pins this so a regression that
  unconditionally sends memory will fail.

### Hybrid AI-employee direction + assistant identity scaffold (by Claude)

**Files changed**

- `docs/product-roadmap.md` — new. 11-phase roadmap from local desktop MVP to hybrid
  AI employee (identity wizard, web/PWA, cloud backend, email/calendar, sheets,
  WhatsApp Business, automation, wake mode with custom name, task queue, enterprise).
- `docs/hybrid-architecture.md` — new. Web app + desktop companion + cloud backend +
  connector services; local vs cloud memory, sync model, permission model, audit model,
  identity/wake-name model, voice-style model, WhatsApp limits, Excel/file handling,
  security boundaries.
- `docs/assistant-identity.md` — new. Why assistant names must be customizable (office
  cross-talk, ecosystem collisions), wake-phrase behavior, voice styles, common-name
  warning logic, storage/audit model, setup-wizard plan, no-always-listening rule.
- `docs/future-package-structure.md` — new. Target monorepo layout (`apps/web`,
  `apps/desktop`, `apps/api`, `packages/core|connectors|automation|shared-ui|voice|identity`)
  plus migration rules.
- `README.md` — added **Long-Term Product Direction** section (hybrid architecture,
  custom assistant identity/wake name, voice styles, no fixed global assistant name).
- `CLAUDE_BUILD_PROMPT.md` — added hybrid-architecture rules for all future work
  (don't build everything in Electron, configurable identity, custom wake name,
  configurable voice style, no always-listening without permission+indicator+audit).
- `packages/core/src/identity/types.ts` — new. `AssistantIdentity`,
  `AssistantIdentityInput`, `VoiceStyle` ('female' | 'male' | 'neutral'),
  `NameCheckResult`.
- `packages/core/src/identity/common-names.ts` — new. `checkAssistantName()` validation
  (empty/too-long/control-chars rejected) with warnings for ecosystem names
  (alexa/siri/google/cortana/bixby/echo) and generic names (computer/assistant/ai/hey);
  `wakePhraseFor()` derives "Hey <name>".
- `packages/core/src/identity/store.ts` — new. `AssistantIdentityStore`: SQLite-backed,
  local-only, defaults to unconfigured/neutral with NO built-in default name; every
  `setIdentity()` writes an `identity.update` audit entry with before/after values and
  any overridden common-name warning.
- `packages/core/src/identity/index.ts` + `packages/core/src/index.ts` — exports.
- `packages/core/src/db/schema.ts` — added `identity_settings` key/value table
  (`IF NOT EXISTS`, no schema-version bump — same upgrade pattern as `provider_settings`).
- `packages/core/src/__tests__/identity.test.ts` — new vitest suite: name validation,
  common-name warnings, wake-phrase derivation, store defaults, persistence, editing,
  validation errors, audit entries (including overridden-warning capture).
- `docs/handoffs/2026-06-12-claude-hybrid-ai-employee-roadmap.md` — handoff for Codex.

**Why it changed**

The product direction was upgraded: the goal is a full AI employee/assistant working
across web, desktop, email, sheets, files, browser, reminders, WhatsApp, and voice — on
a hybrid architecture — rather than a desktop-only chat app. A customizable assistant
name is now a product requirement because a fixed global name would make every
assistant in an office respond to the same wake command. This pass documents the
direction and scaffolds only the first safe step: a local-only identity settings model
with no UI, no wake mode, no cloud backend, and no new monitoring.

**TODOs / known risks**

- Tests not run locally (no `node_modules` on this PC) — verify the new identity suite
  in GitHub Actions CI.
- The identity store is not yet wired into the desktop app (no IPC, no UI). Phase 2
  (setup wizard + Settings screen) does that wiring.
- Always-listening wake mode remains intentionally unimplemented; rules for adding it
  later are in `docs/assistant-identity.md`.

## Change Log Rules

When any assistant or developer changes the project, add:

- Date
- Files changed
- What changed
- Why it changed
- Any known risks or TODOs

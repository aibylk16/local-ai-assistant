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

## Change Log Rules

When any assistant or developer changes the project, add:

- Date
- Files changed
- What changed
- Why it changed
- Any known risks or TODOs

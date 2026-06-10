# Handoff — 2026-06-10 — Claude MVP scaffold

Format follows `COLLABORATION.md → Handoff Format`. Intended audience: Codex (and any future assistant) about to touch this project.

---

## Current status

The repository previously contained only the spec docs (`README.md`, `CLAUDE_BUILD_PROMPT.md`, `COLLABORATION.md`, `CHANGELOG.md`, `docs/*`) and an outline `package-outline.json`. As of this handoff the full MVP scaffold described in `CLAUDE_BUILD_PROMPT.md` is in place — 78 new files across an npm-workspaces monorepo (`apps/desktop`, `packages/{core,connectors,background-worker}`) plus tests and updated docs.

The app has not been `npm install`-ed yet by me. After `npm install && npm run rebuild:native && npm run dev` the desktop app should launch into Chat with `MockProvider` and `MockEmailConnector` active, the offline path working end-to-end (chat → planned tool → confirmation modal → permission check → audit entry → memory write).

---

## Files changed

### Created (78)

**Monorepo root**
- `package.json` — workspaces, scripts (`dev`, `build`, `test`, `rebuild:native`)
- `tsconfig.base.json` — shared TS config, `noUncheckedIndexedAccess` on
- `.gitignore`
- `vitest.config.ts`

**`packages/core/`** — `package.json`, `tsconfig.json`, `src/index.ts`, and:
- `src/db/{index,schema,types}.ts` — `applySchema`, `DB` alias, `EncryptionAdapter` interface
- `src/permissions/{index,types,defaults,engine}.ts` — 15-category permission registry, `PermissionEngine` with `isGranted`/`grant`/`revoke`/`all`/`require`, `PermissionDeniedError`
- `src/audit/{index,service}.ts` — `AuditLogService.record(...)`/`recent(...)`
- `src/memory/{index,encryption,service}.ts` — `NullEncryptionAdapter`, `looksSensitive` regex set, `MemoryService` with `saveCandidate` (refuses sensitive) / `saveManually` (explicit) / upsert by `(kind, key)` / `delete` / `deleteAll` / `exportAll`
- `src/tools/{index,types,registry}.ts` — `Tool<I,O>` with separate `plan`/`execute`, `ToolRegistry`
- `src/providers/{index,types,mock}.ts` — `ModelProvider` interface, `MockProvider` (offline heuristics)
- `src/agent/{index,types,orchestrator}.ts` — `AgentOrchestrator.turn(input)` (proposes plan, never runs) and `executePlan(plan)` (re-validates permissions, then runs)
- `src/__tests__/{permissions,memory}.test.ts`

**`packages/connectors/`** — `package.json`, `tsconfig.json`, `src/index.ts`, and:
- `src/email/{types,mock,gmail,graph,imap,pending-detector,index}.ts` — `EmailConnector` interface, `MockEmailConnector` with 3 fixtures, placeholder Gmail/Graph/IMAP adapters (each file's docstring lists the API/scopes/packages needed), heuristic `PendingReplyDetector`
- `src/whatsapp/{types,business-cloud,manual-import,desktop-observation,index}.ts` — interface + 3 adapter placeholders. Reality-check comment block in `types.ts`
- `src/browser/{types,playwright,index}.ts` — placeholder
- `src/filesystem/{types,fs,index}.ts` — `LocalFilesystemConnector`, `writeText` refuses to overwrite

**`packages/background-worker/`** — `package.json`, `tsconfig.json`, `src/index.ts`, `src/worker.ts` — `BackgroundWorker` with `start`/`stop`/`getStatus`, audits every cycle, re-checks permission each tick

**`apps/desktop/`** — `package.json`, `tsconfig.json`, `electron.vite.config.ts`, and:
- `src/main/{index,db,services,ipc,tray}.ts` — Electron main, SQLite + `SafeStorageAdapter`, single `Services` registry, IPC channels (every action re-checks permission), tray with always-visible monitoring status
- `src/preload/index.ts` — `contextBridge` exposing `window.assistant.*`
- `src/renderer/index.html` — strict CSP (`default-src 'self'`)
- `src/renderer/src/{main.tsx, App.tsx, api.ts, styles.css, voice-shim.d.ts}`
- `src/renderer/src/components/{Sidebar,ConfirmationModal}.tsx`
- `src/renderer/src/pages/{Chat,Voice,Permissions,Memory,Audit,Connectors,Monitoring,Pending}.tsx`

### Modified (2)

- `README.md` — added a `Setup` section (Windows + macOS prereqs, install/run/test/package commands, "Adding real providers later" pointers, "How the safety model is enforced in code")
- `CHANGELOG.md` — appended an "Implementation pass — MVP scaffold (by Claude)" block under the 2026-06-10 entry with what changed, why, and a TODOs/risks list

### Untouched

- `package-outline.json` (kept as historical reference; real `package.json` lives next to it)
- `CLAUDE_BUILD_PROMPT.md`, `COLLABORATION.md`, `docs/architecture.md`, `docs/permissions.md`, `docs/privacy-and-memory.md`, `docs/whatsapp-email-plan.md`, `.env.example`

---

## Decisions made

1. **Bundler: `electron-vite`.** Handles main/preload/renderer with one config and externalizes Node deps automatically. Avoids hand-rolling three build configs.
2. **SQLite: `better-sqlite3` (synchronous, native).** Pros: simplest API, no async ceremony, fastest. Con: needs `electron-rebuild` after `npm install` to match the Electron ABI — captured as `npm run rebuild:native`.
3. **Encryption: Electron `safeStorage` via `SafeStorageAdapter` in `apps/desktop/src/main/db.ts`.** Uses DPAPI on Windows and Keychain on macOS. Chose this over `keytar` (which is deprecated). Core stays decoupled because it only knows about the `EncryptionAdapter` interface — tests use `NullEncryptionAdapter`.
4. **Plan/execute split in `AgentOrchestrator`.** `turn()` builds a plan and returns it; `executePlan()` is the only path that runs side effects, and it re-checks permissions even though the engine checked them when the plan was built. This means revoking a permission between proposal and confirmation is honored.
5. **Permissions re-validated at the IPC boundary too.** Every action channel in `ipc.ts` calls `permissions.isGranted(...)` before dispatching. Two layers (IPC + orchestrator) is intentional belt-and-suspenders — a future bug in one layer doesn't bypass safety.
6. **Sensitive data blocker is heuristic, not LLM-driven.** `looksSensitive` in `packages/core/src/memory/encryption.ts` uses a fixed regex set (cards, OTPs, JWTs, secret keys, PIN/Aadhaar/PAN). Auditable, no false-positive surprises from a model. User can still save via `saveManually` (used by the Memory screen — that path is always explicit).
7. **`MockProvider` does NOT call any cloud API and uses keyword heuristics.** Lets the full flow be demonstrated and tested with zero credentials. Real providers slot in behind the `ModelProvider` interface.
8. **WhatsApp = 3 honest adapter slots, all placeholders.** Reality check is in code comments AND in the Connectors screen UI text, so the platform constraint is visible to the user, not just to engineers.
9. **`DesktopObservationAdapter` is off by default and refuses to operate unless the engine has granted BOTH `screen.observe` AND `accessibility`.** Even when implemented, it must drive the tray badge per spec.
10. **Renderer cannot import from `preload/`.** Renamed `renderer/src/api.ts` to declare the `AssistantApi` shape inline rather than reach across — keeps the renderer bundle clean of Electron internals.
11. **Strict CSP.** `renderer/index.html` uses `default-src 'self'`. Any new cloud provider must add an explicit `connect-src` entry for that origin — never a wildcard.
12. **`localOnlyMode = true` hardcoded.** Toggling it requires UI work + a "data sent" confirmation modal before the first cloud call. Flagged in TODOs.

---

## Open TODOs

- [ ] `npm install && npm run rebuild:native` and verify `npm run dev` boots — I did not run installs.
- [ ] Replace the empty 1x1 tray icon (`apps/desktop/src/main/tray.ts`) with a real PNG under `apps/desktop/resources/`.
- [ ] Wire a real `ModelProvider` (Anthropic and/or OpenAI) and remove `localOnlyMode = true` hardcoding in `apps/desktop/src/main/services.ts`. Add a one-time "data may be sent to X" confirmation before the first cloud call.
- [ ] Implement Gmail / Graph / IMAP adapters — each placeholder file lists the exact scopes and packages.
- [ ] Implement the WhatsApp Business Cloud adapter (the only adapter capable of programmatic send).
- [ ] Implement the manual-import WhatsApp parser (handle DD/MM/YYYY vs MM/DD/YYYY locale variance).
- [ ] If/when the desktop observation adapter is implemented, surface a persistent tray badge while observation is active and write an audit entry per cycle.
- [ ] Add a Setup Wizard (first-run flow) that walks the user through the permission categories listed in `docs/permissions.md` instead of dropping them into the Permissions screen cold.
- [ ] Add an in-app "Local-only mode" toggle that visibly disables the cloud provider call path.
- [ ] Add tests for: `BackgroundWorker` start/stop respects permission revocation mid-flight; `PendingReplyDetector` classifies the fixture set correctly; IPC permission re-check denies a revoked-mid-session action.

---

## Risks / blockers

- **`better-sqlite3` native rebuild.** First-time setup on Windows requires Visual Studio Build Tools (Desktop C++ workload). On macOS it needs Xcode CLT. If `rebuild:native` fails, the main process crashes on `getDb()`. The README setup section calls this out.
- **`Tray` may not appear on all macOS setups** without a valid icon image; the empty `nativeImage` works on most builds but is fragile.
- **Web Speech API requires internet on some Chromium builds.** Voice screen will silently fail to recognize without network — swap in a local Whisper backend (behind a new IPC channel) when offline STT matters.
- **`MockProvider`'s heuristics are intentionally dumb.** Don't ship a non-mock UI affordance that implies "the AI understood you" until a real provider is plugged in.
- **Permission gating depends on the IPC boundary being the only way in.** Any future code path that bypasses IPC (e.g. exposing `ipcRenderer.invoke` directly to the renderer, or loosening `contextIsolation`) would break the whole safety model. The current `preload/index.ts` shape is the contract; reviewers should reject any PR that punches a hole in it.
- **The agent's `executePlan` re-checks permissions but does NOT re-prompt for confirmation.** That's fine because the renderer is the only caller and only calls after the modal is approved. If anything else ever calls `executePlan` (e.g. background worker), the worker must show a notification + queue the action for approval, NOT execute directly.

---

## Suggested next step

If you (Codex) are picking this up:

1. Run `npm install && npm run rebuild:native && npm run dev` and verify the app boots. Report any install/build failures back via a new handoff file.
2. Run `npm test` — both vitest suites (`permissions.test.ts`, `memory.test.ts`) should pass against an in-memory SQLite.
3. Pick ONE of:
   - **Replace tray icon + wire a real Anthropic provider.** Low-risk, high-visibility — the app becomes "actually useful". Don't forget the "data sent" confirmation modal before the first Anthropic call.
   - **Implement the Gmail adapter** (`packages/connectors/src/email/gmail.ts`). Higher payoff because the pending-reply flow becomes real, but requires Google Cloud OAuth setup. Keep the refresh token encrypted via `SafeStorageAdapter`.
   - **Build the first-run Setup Wizard.** Pure UI work, no new permissions surface; improves the permission grant experience materially.
4. Append a new handoff under `docs/handoffs/YYYY-MM-DD-<who>-<topic>.md` when you're done. Update `CHANGELOG.md`. Do not remove or weaken the permission, confirmation, or audit invariants — those are load-bearing for the product, not nice-to-haves.

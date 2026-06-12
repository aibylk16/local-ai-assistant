# Handoff — 2026-06-12 — Hybrid AI-employee roadmap + assistant identity scaffold

Format follows `COLLABORATION.md → Handoff Format`. Intended audience: Codex
(for review + commit + push + CI watch).

---

## Current status

The product direction is upgraded from "desktop chat app" to "full hybrid AI
employee/assistant" — documented in four new docs (roadmap, hybrid architecture,
assistant identity, future package structure) plus README and CLAUDE_BUILD_PROMPT
updates. The only code change is the smallest safe scaffold for the new identity
requirement: a **local-only** `AssistantIdentity` data model + SQLite store + name
validation with common-name warnings + a vitest suite. No UI, no IPC wiring, no wake
mode, no cloud backend, no WhatsApp reading, no new monitoring of any kind.

All existing safeguards are untouched: permission engine, confirmation flow, audit
log, local-only mode, provider approval gate, memory rules.

Tests have NOT been run locally (standing policy: no `npm install` on this PC;
`node_modules/` is empty). The new suite is designed to run in the existing GitHub
Actions CI. Nothing has been committed or pushed.

Note for review: early drafts of two files accidentally contained raw ASCII control
bytes (a NUL inside a regex/test literal). Both files were rewritten to avoid
control-character literals entirely (`hasControlChars()` uses code-point checks;
tests build control chars via `String.fromCharCode`). A `rg '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'`
sweep over `packages/core/src` now returns clean — worth re-checking in review.

---

## Files changed

### Created (10)

- `docs/product-roadmap.md` — Phases 1–11: local desktop MVP → identity + setup
  wizard → web/PWA → cloud backend + auth → email/calendar → Excel/Sheets →
  WhatsApp Business/manual import → desktop/browser automation → voice/wake mode
  with custom wake name → task queue + proactive reminders → enterprise hardening.
  Includes sequencing rules (no phase may bypass permission/confirmation/audit).
- `docs/hybrid-architecture.md` — the four components (web app, desktop companion,
  cloud backend, connector services), local vs cloud memory table, sync model,
  permission model, audit model, identity/wake-name model, voice-style model,
  WhatsApp limits, Excel/file handling, security boundaries.
- `docs/assistant-identity.md` — why custom names are required (office cross-talk,
  ecosystem collisions), wake-phrase derivation ("Hey <name>"), match-or-ignore rule,
  voice styles, common-name warning logic, storage model (local first, cloud later
  with approval), audit model, setup-wizard plan, and the five preconditions before
  any always-listening mode may exist.
- `docs/future-package-structure.md` — target monorepo: `apps/web`, `apps/desktop`,
  `apps/api`, `packages/core`, `packages/connectors`, `packages/automation`,
  `packages/shared-ui`, `packages/voice`, `packages/identity` (+ existing
  `background-worker`), with migration rules. Root `package.json` already globs
  `apps/*` / `packages/*`, so new packages need no tooling change.
- `packages/core/src/identity/types.ts` — `VoiceStyle`, `AssistantIdentity`
  (`configured`, `assistantName`, `wakePhrase`, `voiceStyle`, `companyLabel?`),
  `AssistantIdentityInput`, `NameCheckResult`.
- `packages/core/src/identity/common-names.ts` — `ECOSYSTEM_NAMES`
  (alexa/siri/google/cortana/bixby/echo), `GENERIC_NAMES` (computer/assistant/ai/hey),
  `MAX_ASSISTANT_NAME_LENGTH` (40), `checkAssistantName()`, `wakePhraseFor()`.
- `packages/core/src/identity/store.ts` — `AssistantIdentityStore` +
  `IdentityValidationError`. Defaults: unconfigured, empty name, neutral voice.
  Audited `identity.update` writes (before/after + overridden warning), actor
  always `'user'`.
- `packages/core/src/identity/index.ts` — barrel export.
- `packages/core/src/__tests__/identity.test.ts` — 15 tests across validation,
  warnings, wake phrase, store behavior, and audit trail.
- `docs/handoffs/2026-06-12-claude-hybrid-ai-employee-roadmap.md` — this file.

### Modified (4)

- `README.md` — new **Long-Term Product Direction** section near the top: hybrid
  formula (web + desktop + cloud + connectors), roadmap/architecture/identity doc
  links, custom identity + wake name, voice styles, "no fixed global assistant
  name", and a line stating the safeguards apply to every future surface.
- `CLAUDE_BUILD_PROMPT.md` — added the four new docs to the must-read list and a
  **Hybrid-architecture rules for all future work** section (don't build everything
  in Electron, configurable identity, wake mode uses configured name only,
  configurable voice style, no always-listening without permission + visible
  indicator + audit, identity changes audited).
- `packages/core/src/db/schema.ts` — added `identity_settings (key, value,
  updated_at)` table with `IF NOT EXISTS` (same silent-upgrade pattern as
  `provider_settings`; no `SCHEMA_VERSION` bump).
- `packages/core/src/index.ts` — re-export `identity/`.
- `CHANGELOG.md` — new 2026-06-12 entry.

---

## Decisions made

1. **Docs first, minimal code.** Per the task, only the first safe step is
   scaffolded: a data model + store. No setup wizard UI, no IPC channels, no
   renderer changes — that's Phase 2 work and keeps this diff easy to review.
2. **No default assistant name.** The store starts `configured: false` with an
   empty name rather than shipping a placeholder like "Assistant". The UI is
   expected to route unconfigured users into the future setup wizard. This is the
   strongest form of "no fixed global assistant name".
3. **Warnings warn, they don't block.** `checkAssistantName('Alexa')` returns
   `valid: true` plus a warning. The store accepts the name but records the
   overridden warning in the audit entry. Rationale: it's the user's choice, but
   it must be visible and on the record.
4. **Hard validation rejects garbage only**: empty/whitespace, > 40 chars, control
   characters. Anything else is a legitimate name (unicode names work).
5. **Audit actor is always `'user'`** for identity changes — the agent must never
   rename itself. Action name: `identity.update`, risk `low`.
6. **Same storage pattern as `ProviderSettingsStore`** (key/value table,
   `INSERT OR IGNORE` defaults, upsert writes) so the codebase stays uniform.
7. **`identity_settings` added without a schema-version bump**, mirroring decision
   #7 from the 2026-06-12 AI-provider handoff (`IF NOT EXISTS` silent upgrade).
8. **Wake phrase is derived, not stored** (`wakePhraseFor(name)`), so it can never
   drift from the name.
9. **`packages/identity` (separate package) is deferred.** The model lives in
   `packages/core/src/identity/` for now; `docs/future-package-structure.md` says to
   promote it only if it outgrows core (e.g. workspace sync logic in Phase 4).

---

## Open TODOs

- [ ] CI: `npm install && npm test` via GitHub Actions — the new identity suite plus
  the existing permission/memory/provider suites must stay green.
- [ ] Phase 2 wiring (next code pass): IPC channels (`identity:get`, `identity:set`),
  preload + renderer API, first-run setup wizard (name → wake-phrase preview →
  voice style → company label), and a Settings → Assistant Identity screen with a
  disabled "Test voice" placeholder until TTS exists.
- [ ] Decide where the wizard lives relative to the existing screens (likely a
  pre-Chat gate when `configured` is false).
- [ ] When the cloud backend lands (Phase 4), add identity sync behind the standard
  "show and approve what is sent" flow.

---

## Risks / blockers

- **Tests unverified locally** — same standing risk as previous handoffs; CI is the
  canonical check.
- **Control-character regression risk:** if future edits reintroduce raw control
  bytes (it happened twice during this pass via tool-side escaping), TypeScript may
  fail with confusing parse errors. The sweep command in *Current status* is a cheap
  pre-commit check.
- **`identity_settings` rows are created by the store constructor**, so merely
  opening the app after upgrade adds four default rows — harmless, but the Audit
  screen will not show anything until the first real `identity.update`.
- **Docs promise behavior that does not exist yet** (wake mode, web app, cloud).
  Each doc labels these as roadmap phases, but reviewers should confirm no doc
  reads as if a feature is already shipped.

---

## Suggested next step

1. **Codex:** review the diff (14 files: 10 created, 4 modified), commit, push,
   watch GitHub Actions (`Verify MVP Scaffold` + Windows artifact workflow).
2. After CI is green, pick the next pass — recommended: **Phase 2 wiring** (setup
   wizard + identity IPC + Settings screen), since the data model is now in place
   and it also naturally absorbs the still-pending "setup wizard" TODO from the
   2026-06-10 handoff and the AI-provider step from the 2026-06-12 handoff.
3. Keep the load-bearing invariants intact: no fixed global assistant name, no
   always-listening mode without permission + visible indicator + audit, no
   weakening of permission/confirmation/audit/local-only safeguards.

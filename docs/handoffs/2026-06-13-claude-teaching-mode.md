# Handoff - 2026-06-13 - Teaching Mode core layer

Format follows `COLLABORATION.md -> Handoff Format`. Intended audience: Codex
(for review + commit + push + CI watch).

---

## Current status

Built on top of Codex's `7937710 Add no-api teachable workflow memory`: a
**Teaching Mode** core layer that records teach-and-reuse sessions and promotes
them into the existing `WorkflowTemplateStore`. The flow is: start session ->
record steps (with local-only raw context) -> record user corrections -> build a
sanitized `WorkflowDraft` (with review warnings) -> user approves it into
private/team/global scope -> the template becomes matchable for future tasks.

Everything is free/no-API: no OpenAI/Claude/Gemini key, no connector, no cloud
service - local SQLite only. The docs and code are explicit that this is
workflow/preference learning, **not** LLM training; no model weights change.

No safeguards were weakened. One safeguard was **strengthened**: the workflow
sanitizer now forces `requires_final_confirmation` on any step whose kind or
instruction indicates send/post/publish/delete/upload/submit/pay/purchase, even
if the input claims a weaker policy - this applies to teaching drafts AND
direct template saves.

Tests NOT run locally (standing no-local-install policy; `node_modules/` is
empty). The new suite (`teaching.test.ts`, 9 tests) is shaped for the existing
GitHub Actions CI. Nothing committed or pushed.

---

## Files changed

### Created (5)

- `packages/core/src/teaching/types.ts` - `TeachingSessionStatus`
  (`recording | drafted | promoted | discarded`), `TeachingSession`,
  `TeachingStep` + `TeachingStepInput` (optional `rawContext`, documented as
  local-only), `LearnedCorrection` + input, `WorkflowDraft` (sanitized steps +
  `warnings[]` for redactions/policy upgrades/vague steps),
  `WorkflowPromotionRequest` (explicit `approvedByUser` flag),
  `WorkflowPromotionResult`.
- `packages/core/src/teaching/store.ts` - `TeachingSessionStore(db, workflows,
  audit?)` + `TeachingSessionError`. Methods: `startSession`, `addStep`,
  `addCorrection`, `createDraft`, `getDraft`, `approveDraft`, `getSession`,
  `listSessions`, `getSteps`, `getCorrections`, `deleteSession`.
- `packages/core/src/teaching/index.ts` - barrel.
- `packages/core/src/__tests__/teaching.test.ts` - 9 tests (see below).
- `docs/teaching-mode.md` - teaching loop, honesty note, privacy boundary
  table (allowed vs never-stored), safety invariants, code map.

### Modified (7)

- `packages/core/src/workflows/sanitizer.ts` - added `SIDE_EFFECT_RE` +
  exported `stepRequiresFinalConfirmation()`; `sanitizeWorkflowStep()` now
  refuses to honor a weaker explicit `dataPolicy` on side-effect steps.
- `packages/core/src/db/schema.ts` - added `teaching_sessions` (status +
  draft JSON), `teaching_steps` (`raw_context` column, FK cascade),
  `teaching_corrections` (nullable `step_position`, FK cascade). All
  `IF NOT EXISTS`, no schema-version bump (same pattern as prior tables).
- `packages/core/src/index.ts` - export `teaching/`.
- `docs/teachable-workflows.md` - implementation pointers, corrections
  behavior, honesty note.
- `docs/privacy-and-memory.md` - new "Teaching Sessions" section (raw context
  local-only, user-deletable, audited; promotion re-sanitized + approved).
- `README.md` - new "Teaching Mode (free, no API)" section.
- `CHANGELOG.md` - new 2026-06-13 entry.

---

## Decisions made

1. **Raw context cannot leak by construction.** `WorkflowStepInput` (the type
   the draft/template layer accepts) has no `rawContext` field, so the draft
   builder cannot pass it through even by mistake. Tests additionally assert
   the serialized draft and the promoted template contain none of the raw
   strings.
2. **Corrections reopen the session.** Adding a step or correction flips a
   `drafted` session back to `recording`, so promoting a stale draft returns
   `not_drafted`. What the user approves is always what gets saved.
3. **Correction semantics:** a correction with `stepPosition` replaces that
   step's instruction in the next draft (last correction wins); a
   whole-session correction (null position) is appended to the draft
   description as `Correction: ...`.
4. **Promotion is two-gated.** `approveDraft` refuses team/global without
   `approvedByUser: true` (audited as `teaching.promotion.blocked`), and the
   underlying `WorkflowTemplateStore.save` still applies its own
   sensitive-content block and shared-scope approval gate. The teaching layer
   never bypasses the workflow layer.
5. **Side-effect enforcement lives in the sanitizer**, not just the teaching
   layer, so direct `WorkflowTemplateStore.save` calls get the same guarantee.
   Detection checks both step kind (`draft_message`) and instruction/target
   keywords (send/post/publish/delete/upload/submit/pay/purchase/buy/transfer).
6. **Clarifying questions are surfaced as draft warnings** (very short
   instructions, applied redactions, policy upgrades) rather than a separate
   Q&A engine - the future Teaching UI can render them as prompts. Keeps this
   pass free of any NLP dependency.
7. **`deleteSession` is a hard delete** with FK cascade - consistent with the
   memory rules (user data must be deletable). The deletion itself is audited.
8. **Audit actions:** `teaching.session.start`, `teaching.step.add`,
   `teaching.correction.add`, `teaching.draft.create`,
   `teaching.promotion.blocked`, `teaching.draft.promote`,
   `teaching.session.delete`.

---

## Open TODOs

- [ ] CI run: the new `teaching.test.ts` suite + all existing suites
  (`permissions`, `memory`, `providers`, `identity`, `workflows`).
- [ ] Next pass: Teaching UI - IPC channels (`teaching:start`, `teaching:step`,
  `teaching:correct`, `teaching:draft`, `teaching:promote`, `teaching:list`,
  `teaching:delete`), a Teaching screen (record, review draft + warnings,
  scope picker with explicit approval checkbox), and a workflow library view.
- [ ] Replay engine: matching exists, execution does not. Replay must go
  through the existing plan -> permission -> confirmation -> audit pipeline and
  honor `dataPolicy` per step (hard-stop modal on
  `requires_final_confirmation`).
- [ ] Consider surfacing `WorkflowDraft.warnings` in the chat flow as the
  "clarifying questions" the assistant asks during teaching.
- [ ] The web app's mock chat could later read the workflow library
  (read-only) - needs the cloud/sync story first; do not wire it directly.

---

## Risks / blockers

- **Tests unverified locally** - CI is the canonical check, as before.
- **Keyword-based side-effect detection is English-only.** A Hindi/Marathi
  instruction like "invoice bhejo" won't trigger the upgrade. Mitigation: the
  replay engine must treat step policy as a floor - final confirmation for
  sensitive tool categories stays mandatory regardless of stored policy. Noted
  in CHANGELOG TODOs.
- **`SIDE_EFFECT_RE` may over-trigger** (e.g. "download the post report"
  contains "post"). Over-triggering is safe (extra confirmation), never unsafe.
- **Existing workflows tests still pass?** The sanitizer change only *raises*
  policies; the existing `workflows.test.ts` expectations
  (`draft_message -> requires_final_confirmation`, `download ->
  uses_current_user_data`) are unaffected. Worth confirming in CI.
- **Draft JSON stored in `teaching_sessions.draft`** is trusted on read
  (`JSON.parse` with null fallback). It is written only by `createDraft`, but
  if a future migration changes `WorkflowDraft`, old drafts may need a shape
  check before promotion.

---

## Suggested next step

1. **Codex:** review the diff (12 files: 5 created, 7 modified), commit, push,
   watch GitHub Actions.
2. After green CI, pick ONE next pass - recommended: **Teaching UI wiring**
   (IPC + Teaching screen + workflow library), since the core loop is now
   complete and testable end-to-end from the renderer.
3. Keep the invariants intact: raw context never leaves teaching tables,
   team/global promotion requires explicit approval, side-effect steps always
   require final confirmation, no execution path bypasses
   plan -> permission -> confirmation -> audit.

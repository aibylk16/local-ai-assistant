# Handoff - 2026-06-13 - Trainable AI Employee Brain

Format follows `COLLABORATION.md -> Handoff Format`. Intended audience: Codex
(review + commit + push + CI watch).

---

## Current status

Built on top of the Teaching Mode core layer (`e3287e9`). Adds the **brain
layer** with four training channels:

- **A. User teaching** - unchanged (existing Teaching Mode).
- **B. Backend/admin training** - NEW. `BackendTrainingImporter` loads generic
  `TaskSeed`s into the existing `WorkflowTemplateStore`.
- **C. Learning from work** - NEW. `LessonStore` records sanitized
  preferences/rules into a new `learned_lessons` table.
- **D. Future fine-tuning data** - NEW. `exportFineTuningRecords()` prepares
  sanitized generic records. Trains nothing.

Everything is free/no-API: local SQLite only, no model weights, no key, no
connector. The docs and code repeatedly state this is structure/preference
learning, **not** LLM training.

No safeguard weakened. Backend training reuses every existing rail: the workflow
store's sensitive-content block, the shared-scope approval gate, and the
sanitizer's forced `requires_final_confirmation` on side-effect steps. On top of
that, seeds and lessons are **refused (not redacted)** when they look private -
stricter than user teaching, because seeds should be generic by construction.

Tests NOT run locally (standing no-local-install policy; `node_modules/` empty).
New suite `training.test.ts` is shaped for the existing GitHub Actions CI.

Codex review tightened two approval edges before commit: `WorkflowTemplateStore`
matching now ignores templates not approved for reuse, and shared lessons require
`approvedByUser: true`. Fine-tuning export also skips unapproved templates.

---

## Files changed

### Created (12)

- `packages/core/src/training/types.ts`
- `packages/core/src/training/sanitizer.ts`
- `packages/core/src/training/seeds.ts`
- `packages/core/src/training/importer.ts`
- `packages/core/src/training/lessons.ts`
- `packages/core/src/training/fine-tuning.ts`
- `packages/core/src/training/chat-copy.ts`
- `packages/core/src/training/index.ts`
- `packages/core/src/__tests__/training.test.ts`
- `docs/training-architecture.md`, `docs/developer-training.md` (2 docs)
- `docs/handoffs/2026-06-13-claude-trainable-ai-brain.md`

### Modified (6)

- `packages/core/src/index.ts` - export `training/`.
- `packages/core/src/db/schema.ts` - added `learned_lessons` table
  (`IF NOT EXISTS`, no schema-version bump).
- `docs/teaching-mode.md` - Teaching Mode framed as channel A.
- `docs/privacy-and-memory.md` - new "Training channels" section.
- `README.md` - new "Trainable AI Employee Brain" section.
- `CHANGELOG.md` - new 2026-06-13 entry.

---

## Decisions made

1. **Seeds are refused, not redacted.** User teaching redacts an accidental
   email; a backend seed with one is rejected (`sensitive_blocked`, audited) so
   the developer fixes the source. `training/sanitizer.ts` intentionally
   over-triggers (any 6+ digit number, any money amount, any email/phone).
2. **Backend training reuses `WorkflowTemplateStore` end to end.** The importer
   never writes the DB directly; it calls `workflows.save`, inheriting the
   sensitive block, scope gate, and forced final-confirmation. Defense in depth:
   even if the strict seed check were bypassed, the store still won't store a
   tampered weaker policy or an unapproved shared scope.
3. **Approval is explicit and auditable.** Team/global seeds need
   `approvedByUser: true` on the seed OR `{ approve: true }` at import time
   (for an admin screen). Approval can be granted, never relaxed below the store.
4. **Built-in seeds ship unapproved.** `OFFICE_TASK_SEEDS` are all team/global
   with `approvedByUser: false`, so a default `importAll` refuses them; an admin
   must approve. Prevents "accidentally seeded global skills" on install.
5. **Channel D prepares data only.** `exportFineTuningRecords` excludes private
   by default, re-sanitizes each record, and drops anything unsafe. It does not
   train, call a model, or touch weights.
6. **Copy guard is code, not just docs.** `chat-copy.ts` holds the approved
   user-facing phrases and `INTERNAL_ONLY_TERMS`; a test asserts no user-facing
   string contains workflow/template/matcher/replay/vector/model-weights/
   fine-tune. A regression that leaks those into chat fails CI.
7. **New audit actions:** `training.seed.import`, `training.seed.blocked`,
   `training.lesson.record`, `training.lesson.delete`, `training.lesson.blocked`.
8. **Approved-for-reuse is enforced on read.** Import/save paths can store
   unapproved private learning for later review, but matching and fine-tuning
   export ignore it until it is approved.

---

## Open TODOs

- [ ] CI run: `training.test.ts` + all existing suites (`teaching`,
  `workflows`, `permissions`, `memory`, `providers`, `identity`).
- [ ] Admin "Train assistant" UI + IPC (import seeds, review refusals, approve
  scope, export fine-tuning data). Must use `TRAINING_UI_TERMS` and keep
  internal vocabulary off the end-user surface.
- [ ] Wire channel C into the real task-completion flow (currently the
  `LessonStore` API exists; nothing calls it automatically yet).
- [ ] When a local/open-source model is connected, build the actual fine-tuning
  step that consumes `exportFineTuningRecords()` output - separate, explicit,
  opt-in.

---

## Risks / blockers

- **Tests unverified locally** - CI is canonical, as before.
- **Strict sanitizer is regex/English-leaning and over-triggers.** Over-trigger
  is safe (blocks a seed for the dev to fix); it can never leak. A future pass
  could add locale-aware rules, but the floor must stay "refuse on doubt".
- **`learned_lessons` rows are trusted on read** (JSON tags parsed with
  fallback). Written only by `LessonStore.record` after sanitization.
- **Existing suites unaffected?** No existing files' behavior changed except
  additive exports and a new table. The sanitizer change from the prior pass is
  untouched. Worth confirming in CI.

---

## Suggested next step

1. **Codex:** review the diff (10 created, 6 modified), commit, push, watch CI.
2. After green CI, pick ONE next pass - recommended: the admin **Train
   assistant** screen + IPC (import/approve/export), since the core brain layer
   is now complete and testable.
3. Keep the invariants: seeds/lessons refused (not redacted) when private,
   team/global require explicit approval, side-effect steps always force final
   confirmation, channel D trains nothing, and internal vocabulary never reaches
   normal chat/UI.

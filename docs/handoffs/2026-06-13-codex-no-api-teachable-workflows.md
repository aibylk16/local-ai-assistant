# Codex Handoff: No-API Teachable Workflows

## Current Status

The project direction now supports a no-API default: users can teach repeatable
office workflows, store sanitized reusable workflow templates, and match future
requests against those templates without requiring OpenAI, Claude, Gemini, or
connector setup.

No full desktop automation was implemented in this pass. This is the safe core
learning/storage layer and documentation needed before building the teaching UI
and executor.

## Files Changed

Created:

- `docs/teachable-workflows.md`
- `docs/handoffs/2026-06-13-codex-no-api-teachable-workflows.md`
- `packages/core/src/workflows/types.ts`
- `packages/core/src/workflows/sanitizer.ts`
- `packages/core/src/workflows/store.ts`
- `packages/core/src/workflows/index.ts`
- `packages/core/src/__tests__/workflows.test.ts`

Modified:

- `packages/core/src/db/schema.ts`
- `packages/core/src/index.ts`
- `docs/privacy-and-memory.md`
- `README.md`
- `CHANGELOG.md`

## Decisions Made

- Added `workflow_templates` as a dedicated table instead of reusing generic
  `memory`, so reusable learning can have stricter sharing rules.
- Workflow scopes are `private`, `team`, and `global`.
- Team/global workflow templates require explicit approval before saving.
- The sanitizer redacts emails, phone numbers, long IDs, and sensitive URL
  query values before storage.
- Sensitive secrets still use the existing `looksSensitive()` blocker.
- Workflow matching is simple token overlap for now; no API or local model is
  required.
- Every save/block action can write audit entries through `AuditLogService`.

## Tests Added

`packages/core/src/__tests__/workflows.test.ts` covers:

- Private taught workflow storage without cloud API dependency.
- Sensitive workflow learning blocked before storage.
- Team/global templates require approval.
- Shared workflow details are sanitized.
- Later task requests can match saved templates.

## Open TODOs

- Run CI to verify tests; local dependencies may still be absent on this PC.
- Add teaching-mode UI.
- Add desktop automation executor that can replay approved workflow steps.
- Add permission checks for each replayed step.
- Add admin/user approval UI for promoting private workflows to team/global.
- Add local model support later for better no-cloud reasoning.

## Risks / Notes

This does not make the assistant fully intelligent without an AI brain. It gives
the project a safe no-API workflow memory layer. True reasoning over new messy
screens should later use either a local model or optional cloud model, but saved
workflow replay can work without an API.

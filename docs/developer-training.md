# Developer Training Guide (backend/admin)

This is for **you, the developer/admin**, training the AI employee from the
backend - not for end users. End users train from the UI (Teaching Mode). See
[training-architecture.md](training-architecture.md) for the big picture.

Reminder: this builds the **brain layer** (task structure + preferences). It does
**not** train an LLM. Nothing here needs an API key or a local model.

## Where seed files live

Built-in seeds ship in code: `packages/core/src/training/seeds.ts`
(`OFFICE_TASK_SEEDS`). They are plain `TaskSeed` objects. You import them through
`BackendTrainingImporter`, which stores them in the same `workflow_templates`
table the UI uses, behind the same safety checks.

You can also load seeds from your own JSON/TS file at runtime and pass them to
`importer.importAll(seeds)` - the importer sanitizes and gates them the same way.

## How to add a new task skill

1. Append a `TaskSeed` to `OFFICE_TASK_SEEDS` (or your own seed list). Keep it
   **generic** - describe the shape of the task, never real data.
2. Choose a `scope`: `private`, `team`, or `global`.
3. For `team`/`global`, set `approvedByUser: true` only after you have reviewed
   the seed, or leave it `false` and approve at import time via
   `importer.import(seed, { approve: true })`.
4. Run the tests (`training.test.ts`) so the sanitizer and approval gate pass.

### Seed format (`TaskSeed`)

| Field | Allowed content |
| --- | --- |
| `goal` | generic task name, e.g. "check unread emails that need reply" |
| `triggerPhrases` | how a user might ask; generic |
| `apps` | app/site names, e.g. `["gmail", "excel"]` |
| `steps` | ordered generic steps (`kind`, `instruction`, optional `app`/`target`/`selectorHint`) |
| `requiredPermissions` | permission categories the task will request |
| `finalConfirmation` | advisory: does it end in a side effect? (the sanitizer forces it anyway) |
| `scope` | `private` / `team` / `global` |
| `approvedByUser` | must be `true` (or `{ approve: true }` at import) for team/global |
| `tags` | generic labels |

### What is NOT allowed in a seed

Email/WhatsApp bodies, customer names, phone numbers, email addresses,
passwords, OTPs, API keys, private file contents, exact order/invoice IDs,
prices/money amounts, bank/payment info. A seed containing any of these is
**refused** at import (reason `sensitive_blocked`) and audited - fix the seed,
don't ship a half-redacted one.

## How to import seeds

```ts
import {
  BackendTrainingImporter,
  OFFICE_TASK_SEEDS,
  WorkflowTemplateStore,
} from '@local-ai-assistant/core'

const workflows = new WorkflowTemplateStore(db, audit)
const importer = new BackendTrainingImporter(workflows, audit)

// Import the built-in office skills after admin review:
const summary = importer.importAll([...OFFICE_TASK_SEEDS], { approve: true })
console.log(summary.imported, 'imported,', summary.refused, 'refused')

// Or one at a time:
const result = importer.import(mySeed)
if (result.importedTemplateId === null) {
  console.warn('refused:', result.reason, result.warnings)
}
```

## How to test the sanitizer

The strict seed/lesson sensitivity check lives in
`packages/core/src/training/sanitizer.ts`:

- `findSeedSensitiveIssues(seed)` → list of issues; empty means safe.
- `findLessonSensitiveIssues(lessonInput)` → same, for channel-C lessons.
- `seedStructureIssues(seed)` → structural problems (no goal/trigger/steps).

To verify a seed before shipping, call `findSeedSensitiveIssues` and assert it
returns `[]`. The test suite (`training.test.ts`) shows examples of seeds that
must be blocked (email, invoice number, money amount, phone number).

## How to promote private → team → global

The promotion rules are the same as user teaching:

- **private**: no extra approval to store; reusable only for that user.
- **team** ("Company learning"): requires explicit approval
  (`approvedByUser: true` or `{ approve: true }`). Sanitized and re-checked.
- **global**: same as team, plus the content must be fully generic.

The importer refuses team/global without approval (reason `approval_required`,
audited as `training.seed.blocked`). The underlying `WorkflowTemplateStore` also
independently refuses sensitive content and unapproved shared scopes - backend
training never bypasses it.

## How to export sanitized examples for future fine-tuning

```ts
import { exportFineTuningRecords } from '@local-ai-assistant/core'

const records = exportFineTuningRecords({
  templates: workflows.list(),   // shared scopes only, by default
  lessons: lessonStore.list(),
  // includePrivate: true,        // opt in; still re-sanitized per record
})
// `records` are generic instruction/context/response objects. Persist them
// however you like for a LATER, explicit fine-tuning run.
```

This export **does not train a model**. It only prepares safe, generic data.
Private knowledge is excluded unless you explicitly opt in, and every record is
re-sanitized and dropped if anything still looks sensitive.

## Audit actions you will see

- `training.seed.import` - a seed was stored (ok).
- `training.seed.blocked` - a seed was refused (invalid / sensitive / approval).
- `training.lesson.record`, `training.lesson.delete`, `training.lesson.blocked`.

Important: these terms (`workflow`, `template`, `seed`, `fine-tune`) are
**developer/admin** vocabulary. They must never surface in normal end-user chat
or UI - see the copy guard in `chat-copy.ts`.

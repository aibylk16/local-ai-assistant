# Trainable AI Employee Brain

This document describes how the assistant is *trained* - i.e. how its **brain
layer** of task knowledge and preferences is built up - and the hard rules that
keep it safe.

## Honesty first: this is not LLM training

This pass does **not** train or fine-tune a language model. No model weights are
created or changed, and nothing here requires a paid API, a connector, or a
local model (Ollama/LM Studio). "Training" here means building the **brain
layer**: recording, sanitizing, and reusing task **structure** and
**preferences** through the existing local workflow store (SQLite).

A real open-source/local model may be connected and fine-tuned **later**, using
the sanitized examples this system can export (channel D below). That is a
separate, explicit, future step. It does not happen now.

## The four training channels

### A. User teaching

The user teaches a task from the UI: steps, corrections, examples, a preferred
output style, and approval rules. This is the existing **Teaching Mode** - see
[teaching-mode.md](teaching-mode.md). It produces a sanitized, reviewable draft
the user promotes into private/team/global learning.

### B. Backend / admin training (developer-seeded skills)

A developer or admin can pre-load common office skills from backend seed files
or scripts, so a fresh install is useful on day one. Examples:

- Gmail unread triage ("check unread emails that need reply").
- WhatsApp pending-reply triage ("draft a polite reply").
- Amazon/seller report download + Excel summary.
- Excel cleanup and summary.
- Browser open/search tasks.
- File organization ("organize downloaded invoices by month").
- Daily/weekly report generation.

Seeds are **generic by construction**. They describe how a task is done, never a
real user's data. See [developer-training.md](developer-training.md) for the seed
format, where seeds live, and how to add one. Implementation:
`packages/core/src/training/` (`seeds.ts`, `importer.ts`).

### C. Learning from successful work

After a task completes, the assistant can record (or ask to record) a small,
**reusable lesson** - never user content. Lesson kinds:

- `output_format` - "group monthly reports by week, totals on top".
- `step_order` - "filter by last month before summarizing".
- `confirmation_preference` - "always confirm before sending to a customer".
- `app_preference` - "use the browser report page, not the email export".
- `classification_rule` - "treat newsletters as no-reply".

Lessons are sanitized and stored locally (`learned_lessons` table) via
`LessonStore` (`packages/core/src/training/lessons.ts`). A lesson that looks like
it carries private data is **refused**, not redacted.

### D. Future fine-tuning dataset

Every safe piece of learned knowledge can optionally be exported as **sanitized,
generic training records** for a future fine-tuning step. `exportFineTuningRecords()`
(`packages/core/src/training/fine-tuning.ts`) converts shared workflow templates
and lessons into instruction/context/response records, re-running the sensitivity
check and dropping anything unsafe.

**This export does not train anything.** It only prepares data. Private knowledge
is excluded by default.

## Invisible use in chat

The user gives a normal command; the assistant silently uses what it has learned
and reports results naturally. It must **not** expose internal mechanics.

| Do not say (internal mechanics) | Say instead (natural) |
| --- | --- |
| "I found a saved workflow." | "I can do that." |
| "A template matched." | "I'll use your usual format." |
| "Replay started." | "I'll prepare the report the way you showed me." |
| — | "Please allow me to open Gmail." |
| — | "Before I send this, please confirm." |

The approved phrases live in `TRAINED_REUSE_COPY`
(`packages/core/src/training/chat-copy.ts`). A test asserts none of the
user-facing copy contains `workflow`, `template`, `matcher`, `replay`, `vector`,
`model weights`, or `fine-tune`. Those words are allowed **only** in developer
docs and admin/backend settings.

## Training UI terms

Normal (non-developer) UI uses friendly words:

- **Train assistant**, **Teach a task**
- **My assistant learned this**, **Use this style next time**
- **Save as my way of doing this**
- **Company learning** (team), **Personal learning** (private)

These map to `TRAINING_UI_TERMS` in `chat-copy.ts`.

## Privacy and scope

Learning has three scopes, identical to the workflow store:

- **Personal (private)** - only this user.
- **Team (company learning)** - sanitized AND explicitly approved.
- **Global** - fully generic AND explicitly approved.

The assistant may reuse process **structure** across users, but never another
user's personal or business content.

### Never stored or shared (any channel)

Email/WhatsApp message bodies, customer names, phone numbers, email addresses,
passwords, OTPs, API keys, private file content, exact order/invoice IDs,
bank/payment info. Backend seeds and lessons that contain any of these are
**refused** (not silently redacted) so the source gets fixed.

## Permission and confirmation rules (no bypass)

Backend training pre-loads *knowledge*; it grants **no new powers**. Every
trained task still goes through the same rails as everything else:

1. Permission before opening an app/site/file.
2. Final confirmation before send/post/delete/upload/submit/pay.
3. Audit-log entries for important actions.
4. No execution directly from a chat response - always
   plan → permission → confirmation → audit.

Side-effect steps are forced to `requires_final_confirmation` by the workflow
sanitizer regardless of what a seed or lesson claims. Backend training cannot
relax this.

## Where the code lives

- `packages/core/src/training/types.ts` - `TaskSeed`, `SeedStep`,
  `LearnedLesson`, `FineTuningRecord`, result types.
- `packages/core/src/training/seeds.ts` - built-in generic `OFFICE_TASK_SEEDS`.
- `packages/core/src/training/importer.ts` - `BackendTrainingImporter`.
- `packages/core/src/training/lessons.ts` - `LessonStore` (channel C).
- `packages/core/src/training/fine-tuning.ts` - `exportFineTuningRecords` (channel D).
- `packages/core/src/training/sanitizer.ts` - strict seed/lesson sensitivity checks.
- `packages/core/src/training/chat-copy.ts` - approved user-facing copy + term guard.
- `packages/core/src/__tests__/training.test.ts` - pins every invariant above.

# Teaching Mode

Teaching Mode is how the assistant "learns" in the free, no-API baseline: the
user teaches a task once, the assistant records generic steps, and an approved,
sanitized workflow template comes out the other end for reuse.

## Honesty first: this is not model training

The app does **not** train or fine-tune an LLM. No model weights change. What
the assistant learns is **workflow structure and preferences**: which apps to
open, which generic steps to take, what report layout the user prefers, which
steps need confirmation. A local LLM (Ollama/LM Studio) or a cloud provider can
be added later as an optional upgrade - none of this requires one, and none of
this requires an API key, connector setup, or any paid service. Storage is
local SQLite.

## The teaching loop

1. **User starts a session** with a goal ("monthly Amazon sales report").
2. **Assistant records steps** the user demonstrates or describes. Each step is
   a generic instruction (`open_url`, `download`, `transform_table`, etc.) plus an
   optional `rawContext` - temporary user context like "this is the supplier
   mail I mean".
3. **Assistant asks clarifying questions** where a step is unclear. The draft
   builder flags very short instructions as warnings so the UI knows what to
   ask about.
4. **A sanitized workflow draft is created.** Raw context is dropped entirely;
   emails, phone numbers, long IDs, and secret-looking URL parameters are
   redacted from instructions; side-effect steps are upgraded to require final
   confirmation. The draft lists every redaction/upgrade as a warning the user
   reviews.
5. **User corrections** ("no - group by month first") are recorded. A
   correction reopens the session, and the stale draft can no longer be
   promoted until it is rebuilt - corrections always make it into what gets
   saved.
6. **User approves the draft into a scope:**
   - `private` - only this user.
   - `team` - same office/company. Requires explicit approval.
   - `global` - fully generic, no company/user data. Requires explicit approval.
7. **Later, a similar request matches the saved workflow.** The assistant says
   "I know a saved workflow for this. Should I use it?" - and still asks
   permission before opening apps/sites/files, and final confirmation before
   any send/post/delete/upload/submit/payment step.

## Where the code lives

- `packages/core/src/teaching/types.ts` - `TeachingSession`, `TeachingStep`,
  `LearnedCorrection`, `WorkflowDraft`, `WorkflowPromotionRequest`.
- `packages/core/src/teaching/store.ts` - `TeachingSessionStore`: start
  session, add step, add correction, create sanitized draft, approve draft as
  private/team/global, list sessions, delete session.
- `packages/core/src/workflows/` - the template store the drafts promote into
  (sanitizer, sensitive-content block, scope approval gate, matching).
- `packages/core/src/__tests__/teaching.test.ts` - pins every invariant below.

## Privacy boundaries

The raw teaching session (including `rawContext`) is **local-only**, viewable
and deletable by the user. The sanitized draft and any promoted template
contain workflow **structure** only:

| Allowed in drafts/templates | Never in drafts/templates |
| --- | --- |
| generic task names | email/WhatsApp message bodies |
| trigger phrases | customer names |
| app/site names | phone numbers, email addresses |
| generic steps and sanitized selectors | order/invoice IDs, prices (unless anonymized) |
| report layout and transformation logic | files or file contents |
| confirmation rules | passwords, OTPs, API keys, bank/payment info |
| preferred generic output formats | private company data |

Two layers enforce this: the draft builder redacts and drops raw context, and
the workflow template store independently refuses to save anything that still
looks sensitive (`looksSensitive` heuristics - passwords, OTPs, card numbers,
keys, JWTs).

## Safety invariants

Saved workflows never bypass safety. Every replay still goes through:

1. understand task -> 2. match saved workflow -> 3. show plan ->
4. check permission -> 5. ask user approval -> 6. execute -> 7. audit ->
8. **final confirmation for send/post/delete/upload/submit/payment** ->
9. summarize result.

Additional guarantees, each pinned by a test:

- A side-effect step can never be stored with a policy weaker than
  `requires_final_confirmation` - even if the input claims otherwise, and even
  if someone writes directly to the template store.
- Team/global promotion without `approvedByUser: true` is refused and the
  refusal is written to the audit log.
- Promoted sessions are locked; deleted sessions take their steps and
  corrections with them.
- Every session start, step, correction, draft, promotion, and blocked
  promotion is audit-logged.
- No side-effect action can happen directly from a chat response - execution
  always goes through the plan/permission/confirmation pipeline above.

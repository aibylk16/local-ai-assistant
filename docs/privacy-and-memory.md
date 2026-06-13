# Privacy And Memory

## Memory Goals

The assistant should learn helpful things such as:

- User preferences.
- Common work patterns.
- Frequent contacts.
- Repeated instructions.
- Pending tasks.
- Response style.
- Important projects.
- Sanitized workflow templates that can be reused without private data.

## What Not To Store Automatically

Do not automatically store:

- Passwords.
- OTPs.
- Payment card details.
- Government ID numbers.
- Private health/financial details unless user explicitly saves them.
- Full chat history unless user explicitly allows it.
- Email or WhatsApp message bodies in shared workflow learning.
- Customer names, phone numbers, exact order IDs, invoice IDs, or file contents
  in team/global workflow templates.

## Storage

Use local encrypted storage:

- SQLite for structured data.
- Encrypted memory table for sensitive preferences.
- OS keychain for encryption keys.
- Optional vector index for semantic search.

## Memory Controls

The app must provide:

- View memory.
- Edit memory.
- Delete memory.
- Disable learning.
- Pause background monitoring.
- Export all data.
- Delete all data.

## Workflow Learning Boundaries

Workflow learning is split into three scopes:

- Private: user-specific memory, visible only to that user.
- Team: reusable office workflow, approved for the organization.
- Global: generic template with no user or company data.

The assistant may reuse workflow structure across users, but it must not reuse
another user's personal or business content. Promoting private learning into
team/global learning requires sanitization and explicit approval.

## Teaching Sessions

Teaching Mode (see [teaching-mode.md](teaching-mode.md)) records raw sessions
while the user teaches a task. These raw sessions:

- May contain temporary user context (`rawContext`) - e.g. "this is the
  supplier mail I mean" - so the user can review what they taught.
- Are LOCAL-ONLY: raw context never enters a workflow draft, never enters a
  template of any scope, and never syncs anywhere.
- Are user-controlled: sessions can be listed and deleted, and deleting a
  session removes its steps and corrections.
- Are audit-logged: session start, steps, corrections, drafts, promotions, and
  blocked promotions all write audit entries.

Promotion from a teaching session into team/global workflow memory requires
explicit user approval, and the sanitized draft is independently re-checked by
the workflow store's sensitive-content block before saving. Side-effect steps
(send/post/delete/upload/submit/payment) always require final confirmation at
replay time, no matter what the session recorded.

## Training channels (backend seeds and lessons)

The assistant's brain layer is also fed by developer-seeded office skills and by
small lessons learned after a task completes (see
[training-architecture.md](training-architecture.md)). These follow the same
privacy rules as user teaching:

- Backend seeds must be GENERIC by construction. A seed containing an email,
  phone number, order/invoice ID, money amount, or any credential is **refused**
  at import (not redacted) and the refusal is audited.
- Channel-C lessons store only sanitized preferences and rules (output format,
  step order, confirmation/app preference, classification rule) - never message
  bodies, contacts, IDs, or file contents. A lesson that looks private is
  refused.
- Team/global seeds and lessons require explicit approval, exactly like teaching
  promotion.
- The future fine-tuning export (channel D) only prepares sanitized, generic
  records; it excludes private knowledge by default and trains nothing.

## Cloud AI Safety

If using a cloud AI model:

- Send the minimum needed context.
- Redact sensitive values where possible.
- Show a setting for "local-only mode".
- Make cloud use visible in the UI.

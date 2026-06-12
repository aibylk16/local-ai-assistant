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

## Cloud AI Safety

If using a cloud AI model:

- Send the minimum needed context.
- Redact sensitive values where possible.
- Show a setting for "local-only mode".
- Make cloud use visible in the UI.

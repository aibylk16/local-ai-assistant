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

## What Not To Store Automatically

Do not automatically store:

- Passwords.
- OTPs.
- Payment card details.
- Government ID numbers.
- Private health/financial details unless user explicitly saves them.
- Full chat history unless user explicitly allows it.

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

## Cloud AI Safety

If using a cloud AI model:

- Send the minimum needed context.
- Redact sensitive values where possible.
- Show a setting for "local-only mode".
- Make cloud use visible in the UI.


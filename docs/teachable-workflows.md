# Teachable Workflows

The product must work without a cloud AI API by default. Users should be able to
teach the assistant repeatable office workflows, store the safe structure of
those workflows, and reuse them later across users or teams.

## Product Goal

The assistant should learn how work is done, not memorize private data.

Examples:

- Check unread email, classify which messages need a reply, and draft replies.
- Check WhatsApp Web/Desktop for pending replies.
- Download Amazon reports and build an Excel analysis.
- Clean a spreadsheet, create pivots, charts, and summary notes.
- Follow a company-specific browser workflow.

## No-API Default

The default product mode is:

- No OpenAI API key.
- No Claude API key.
- No Gemini API key.
- No connector requirement for the first working version.
- Local workflow memory plus desktop automation.

Cloud AI providers can remain optional future upgrades. They must never be
required for the basic teach-and-reuse workflow loop.

## Teaching Loop

1. User starts teaching mode.
2. Assistant records high-level actions with permission.
3. User explains intent where needed.
4. Assistant converts actions into a sanitized workflow template.
5. User reviews the template.
6. User chooses where it can be reused: private, team, or global.
7. Future tasks are matched against saved workflow templates.
8. Assistant asks permission before replaying or adapting the workflow.

## What Can Be Stored

Workflow memory may store:

- Generic task names.
- Trigger phrases.
- App/site names.
- Sanitized URL or screen targets.
- Generic selectors or visual hints.
- Transformation logic.
- Report layouts.
- Confirmation rules.
- Which steps require current user data.

## What Must Not Be Stored In Shared Learning

Never store these in team/global templates:

- Email bodies.
- WhatsApp messages.
- Customer names.
- Phone numbers.
- Email addresses.
- Passwords, OTPs, tokens, API keys.
- Order IDs, invoice numbers, exact prices, or account numbers.
- Files or copied file contents.
- Private company instructions unless an admin explicitly approves them.

Private user memory can keep more context only when the user explicitly saves it
and the memory system is enabled.

## Execution Rules

Saved workflows do not bypass safety.

Every replay must still go through:

1. Match workflow.
2. Show plan.
3. Check permissions.
4. Ask user approval.
5. Execute steps.
6. Ask final confirmation for send/post/delete/upload/submit/payment.
7. Audit the result.

## Limits Without An AI API

Without an API or local model, the assistant can reuse taught workflows and
simple matching. It cannot reliably reason over new messy situations. The
intended no-cloud path is to combine teachable workflows with a local model
later, while keeping cloud providers optional.

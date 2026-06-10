# WhatsApp And Email Plan

## Email

Email is realistic through official APIs.

Supported paths:

- Gmail API
- Microsoft Graph for Outlook
- IMAP for generic mailboxes

Features:

- Read unread email.
- Detect emails needing reply.
- Detect emails where user promised an action.
- Remind user about pending email actions.
- Draft replies.
- Send only after confirmation.

## WhatsApp

There is an important limitation:

Personal WhatsApp does not provide a stable official public API to read all chats from WhatsApp Desktop.

Possible routes:

1. WhatsApp Business Cloud API
   - Best official route.
   - Works for business accounts and customer conversations.
   - Cannot simply read every personal WhatsApp chat.

2. WhatsApp Desktop observation
   - Uses screen/accessibility permissions.
   - Can inspect visible chats if user opens WhatsApp Desktop.
   - Fragile because UI changes can break it.
   - Must show visible monitoring status.

3. Manual export/import
   - User exports chats and imports them.
   - Good for learning history.
   - Not real-time unless repeated.

Suggested MVP:

- Implement WhatsApp connector interface.
- Start with manual import and Business API support.
- Add desktop observation only as an opt-in advanced feature.

## Missed Reply Detection

For email and WhatsApp messages, classify each thread into:

- No action needed.
- Needs reply.
- Waiting for someone else.
- User replied.
- Follow-up due.

The assistant should answer questions like:

"Koi message chuta hai jiska reply nahi gaya?"

Expected output:

- Sender/contact
- Message summary
- Last message time
- Why it looks pending
- Suggested reply draft
- Ask before sending


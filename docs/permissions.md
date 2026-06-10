# Permissions Model

The assistant must have a permission center.

## Permission Categories

- Microphone access
- Speaker/text-to-speech access
- File read access
- File write access
- Browser automation
- Email read access
- Email draft access
- Email send access
- WhatsApp read access
- WhatsApp draft access
- WhatsApp send access
- Screen observation
- Accessibility control
- Background monitoring
- Memory learning

## Defaults

All powerful permissions should be off by default.

The setup wizard should ask:

- Do you want voice input?
- Do you want voice output?
- Do you want background monitoring?
- Which apps/accounts can the assistant read?
- Can it only draft messages, or also send after confirmation?
- Should it learn preferences automatically, or ask before saving each memory?

## Confirmation Rules

Always confirm before:

- Sending an email.
- Sending a WhatsApp message.
- Deleting files.
- Sharing private data with another person or service.
- Making purchases or payments.
- Installing software.
- Changing OS settings.

The confirmation dialog should show:

- What the assistant will do.
- Which app/account it will use.
- What data will be sent or changed.
- A Cancel button.
- An Approve button.


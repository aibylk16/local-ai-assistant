# Collaboration Notes

This project may be worked on by multiple AI assistants, such as Codex and Claude.

To keep everyone aligned:

1. Read `README.md` first.
2. Read `CLAUDE_BUILD_PROMPT.md` before implementation.
3. Check `CHANGELOG.md` before making changes.
4. After every meaningful change, update `CHANGELOG.md`.
5. Do not remove privacy, permission, or confirmation safeguards.
6. Do not silently add background monitoring.
7. Do not implement hidden WhatsApp/email reading.
8. Keep user data local unless the user explicitly enables a cloud provider or connector.

## Shared Project Principles

- User permission comes before action.
- User privacy comes before convenience.
- Memory must be visible, editable, and deletable.
- Background activity must be visible and pausable.
- Risky actions require confirmation every time.
- WhatsApp support must be honest about platform limitations.

## Handoff Format

When handing work to another assistant, include:

```text
Current status:
Files changed:
Decisions made:
Open TODOs:
Risks/blockers:
Suggested next step:
```


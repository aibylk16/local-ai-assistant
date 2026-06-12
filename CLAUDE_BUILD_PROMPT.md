# Claude Build Prompt

You are a senior full-stack desktop app engineer. Build a local-first AI assistant desktop app for Windows and macOS.

Before you start, read and preserve the intent of:

- `README.md`
- `COLLABORATION.md`
- `CHANGELOG.md`
- `docs/architecture.md`
- `docs/permissions.md`
- `docs/privacy-and-memory.md`
- `docs/whatsapp-email-plan.md`
- `docs/product-roadmap.md`
- `docs/hybrid-architecture.md`
- `docs/assistant-identity.md`
- `docs/future-package-structure.md`

## Hybrid-architecture rules for all future work

The product direction is a hybrid AI employee (web app + desktop companion + cloud
backend + connectors), not a desktop-only app. All future work must follow these rules:

1. **Follow the hybrid architecture** in `docs/hybrid-architecture.md`. Do not build
   everything only inside Electron — code needed by more than one surface belongs in
   `packages/*` (see `docs/future-package-structure.md`).
2. **Assistant identity must be configurable.** No fixed global assistant name. The
   user/company chooses the name; the wake phrase is "Hey <assistant name>". Use the
   `AssistantIdentity` model in `packages/core/src/identity/`.
3. **Wake mode must use the configured custom name** and ignore voice commands that do
   not match it. Warn on common/colliding names (Alexa, Siri, Google, Computer, ...).
4. **Voice style (female / male / neutral) must be user/company configurable**, stored
   with the identity, editable anytime, and used for TTS when voice output ships.
5. **No always-listening mode** without ALL of: explicit opt-in permission, a visible
   persistent listening indicator, a mute/pause control, and audit log entries. No raw
   audio recording or retention by default.
6. Identity and settings changes must be written to the audit log.

After every meaningful change, update `CHANGELOG.md` with files changed, what changed, why it changed, and any TODOs/risks. This is required because Codex and Claude may both work on the same project.

The user wants:

- A desktop assistant, not mobile.
- Text input and voice input.
- Voice reply/output.
- Background mode with tray icon.
- Explicit user permissions.
- Local learning/memory from user-approved activity.
- Email monitoring for missed replies and pending actions.
- WhatsApp monitoring where possible.
- Strong privacy: user data must not be shared without permission.
- No sending/deleting/purchasing/system changes without confirmation.

Create this as a production-minded MVP using:

- Electron + React + TypeScript for desktop.
- Node.js backend inside Electron main process or a local worker.
- SQLite for local data.
- Encrypted local memory using OS keychain-backed encryption.
- A pluggable model provider interface so the user can use Claude, OpenAI, or local models later.
- A permission engine that gates every tool.
- A visible background worker/tray indicator.

Important constraints:

1. Do not build spyware.
2. Background monitoring must be opt-in, visible, pausable, and logged.
3. Memory must be viewable, editable, exportable, and deletable.
4. High-risk actions must always ask confirmation:
   - send email/message
   - delete files
   - purchase/pay
   - install software
   - change system settings
   - share private data externally
5. If using a cloud AI model, show what data can be sent and minimize context.
6. Add local-only mode.

WhatsApp requirement:

- Explain in code/docs that personal WhatsApp has no stable official public API for reading all chats.
- Implement a connector interface with these adapters:
  - WhatsApp Business Cloud API adapter placeholder
  - manual chat export/import adapter placeholder
  - desktop observation adapter placeholder, disabled by default and requiring explicit screen/accessibility permission
- Do not send WhatsApp messages without confirmation.

Email requirement:

- Implement connector interface for Gmail/Microsoft/IMAP.
- MVP can include mock connector plus documented real connector boundary.
- The assistant should identify missed replies and pending email actions.
- It should draft replies but require confirmation before sending.

Core screens:

- Chat screen
- Voice controls
- Permission center
- Memory manager
- Activity/audit log
- Connector settings
- Background monitoring status
- Pending replies/actions page

Core modules:

- Agent orchestrator
- Permission engine
- Tool registry
- Memory service
- Audit log service
- Background worker
- Email connector
- WhatsApp connector
- Voice input/output service

Data models:

- Permission
- AuditLog
- MemoryItem
- Task
- ConnectorAccount
- MessageThread
- PendingAction

Build the project with clean folder structure:

```text
local-ai-assistant/
  CHANGELOG.md
  COLLABORATION.md
  apps/
    desktop/
      src/
        main/
        renderer/
        preload/
  packages/
    core/
      src/
        agent/
        memory/
        permissions/
        audit/
        tools/
    connectors/
      src/
        email/
        whatsapp/
        browser/
        filesystem/
    background-worker/
      src/
  docs/
  package.json
  README.md
```

Implementation steps:

1. Scaffold the monorepo.
2. Build Electron app with React UI.
3. Add SQLite schema and services.
4. Add permission engine.
5. Add audit log.
6. Add memory manager.
7. Add mock AI provider and provider interface.
8. Add chat UI that routes commands through the agent.
9. Add voice input and voice output.
10. Add background worker and tray status.
11. Add email mock connector and pending-reply detector.
12. Add WhatsApp connector interface with safe placeholders.
13. Add confirmation modal for high-risk actions.
14. Add tests for permission gating and memory behavior.
15. Add README setup instructions for Windows and macOS.

Deliverables:

- Working local desktop MVP.
- Clear README.
- Security and privacy notes.
- Instructions for adding real Gmail, Outlook, WhatsApp Business, Claude/OpenAI providers later.

Do not skip the permission model. Do not make actions happen silently.

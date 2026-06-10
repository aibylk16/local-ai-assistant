# Local AI Assistant Project

This is a local-first desktop AI assistant plan for Windows and macOS.

Goal: build an assistant that can understand text and voice commands, ask permission before acting, work in the background, learn from approved activity, remember useful preferences, monitor missed emails/messages, and keep user data private.

## Important Reality Check

The assistant can be powerful, but it must have clear permission and privacy controls.

It should not silently watch everything by default. It should:

- Ask for explicit permission during setup.
- Show when background monitoring is active.
- Let the user pause/resume monitoring.
- Store memory locally with encryption.
- Let the user view, edit, export, or delete memory.
- Require confirmation before sending messages, deleting files, making purchases, payments, or changing system settings.

## Suggested Tech Stack

- Desktop shell: Electron + React + TypeScript
- Local backend: Node.js service, with optional Python worker for automation
- Local database: SQLite
- Vector memory: SQLite vector extension or LanceDB
- Encryption: OS keychain plus encrypted local database
- Voice input: Web Speech API for prototype, later Whisper/local STT
- Voice output: OS text-to-speech or OpenAI TTS
- AI model: provider pluggable, such as Claude/OpenAI/local LLM
- Browser automation: Playwright with explicit permission
- Desktop automation: OS accessibility APIs, guarded by permissions
- Email: Gmail API, Microsoft Graph, or IMAP
- WhatsApp:
  - Best supported route: WhatsApp Business Cloud API for business accounts.
  - Personal WhatsApp full-chat reading is not officially supported through a stable public API.
  - WhatsApp Desktop UI observation may be possible with user-granted accessibility/screen permissions, but it is fragile and must be transparent.

## First Version Scope

Build MVP:

1. Desktop app for Windows/macOS.
2. Text chat input.
3. Voice input and voice reply.
4. Permission center.
5. Local encrypted memory.
6. Task history and activity log.
7. Email connector for unread/missed-action reminders.
8. WhatsApp module interface with safe placeholders:
   - Business API connector if available.
   - Manual export/import or desktop observation module later.
9. Background worker with visible tray icon.
10. Confirmation modal for all external actions.

## Multi-Assistant Collaboration

This project includes:

- `CHANGELOG.md` for recording all meaningful changes.
- `COLLABORATION.md` for keeping Codex, Claude, and the user aligned.

Before making changes, any assistant should read the README, build prompt, collaboration notes, and changelog. After making changes, update the changelog.

## Folder Structure

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
    architecture.md
    permissions.md
    privacy-and-memory.md
    whatsapp-email-plan.md
  .env.example
  package.json
  README.md
```

## Setup

### Prerequisites

- Node.js 20 LTS or newer
- npm 10+ (ships with Node 20)
- **Windows:** Visual Studio Build Tools with the "Desktop development with C++" workload (needed to compile `better-sqlite3`)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)

### Install and run (Windows + macOS)

```bash
# from this folder
npm install
# rebuild better-sqlite3 against the Electron ABI (one-time per Electron upgrade)
npm run rebuild:native
# launch the desktop app in dev mode (hot-reloads renderer)
npm run dev
```

### Tests

```bash
npm test
```

### Package a distributable

```bash
# Windows installer
npm run package:win -w apps/desktop
# macOS .dmg
npm run package:mac -w apps/desktop
```

### Adding real providers later

The MVP runs in local-only mode against a `MockProvider` and a `MockEmailConnector` so the full
permission/audit/memory flow can be exercised without any account or cloud key. To plug in real
services, implement the documented interfaces — each placeholder file lists the exact steps:

- **Anthropic (Claude) / OpenAI:** implement `ModelProvider` (`packages/core/src/providers/types.ts`).
  Add a UI toggle that disables `localOnlyMode`. Before the first call, show the
  `dataSentNotice` from `ProviderInfo` in a confirmation modal.
- **Gmail:** `packages/connectors/src/email/gmail.ts` — OAuth2 with `gmail.readonly` /
  `gmail.send`, refresh token in OS keychain via `safeStorage`.
- **Outlook / Microsoft Graph:** `packages/connectors/src/email/graph.ts` — MSAL OAuth2 with
  `Mail.Read` / `Mail.Send`.
- **IMAP / SMTP:** `packages/connectors/src/email/imap.ts` — `imapflow` + `nodemailer`.
- **WhatsApp Business Cloud:** `packages/connectors/src/whatsapp/business-cloud.ts` — Meta
  Graph API. Note: webhooks require a server-side relay since the desktop app cannot host one.
- **WhatsApp Manual Import:** `packages/connectors/src/whatsapp/manual-import.ts` — parse the
  standard exported `.txt`/`.zip` format.
- **WhatsApp Desktop Observation:** `packages/connectors/src/whatsapp/desktop-observation.ts` —
  macOS AX / Windows UIA. Must remain disabled by default and visible in the tray when active.

### How the safety model is enforced in code

- `apps/desktop/src/main/ipc.ts` re-checks every permission before invoking a tool — granting a
  permission is not the same as confirming an action.
- `packages/core/src/agent/orchestrator.ts` separates `turn()` (proposes a plan, never executes)
  from `executePlan()` (re-validates permissions, then runs). The renderer is the only path that
  triggers `executePlan`, and it must show a `ConfirmationModal` first.
- `packages/core/src/memory/encryption.ts` blocks candidate memories matching common
  sensitive-data patterns (cards, OTPs, JWTs, secret keys). Users can still save those via the
  Memory screen — that path is `saveManually` and is always explicit.
- `apps/desktop/src/main/tray.ts` updates the tray tooltip and context menu every 5 seconds so
  background monitoring is never silent.

## Core Product Rules

- No action without permission.
- User data stays local unless the user explicitly connects an AI provider or cloud service.
- Any cloud AI request must show what data may be sent.
- Memory must be reviewable and deletable.
- Background monitoring must be opt-in.
- Sensitive tasks require confirmation.
- Every completed action must create an audit log entry.

# Hybrid Architecture — Web App + Desktop Companion + Cloud Backend

The long-term product is an AI employee that is reachable from anywhere (web) and can
act on the user's computer (desktop), with a cloud backend coordinating accounts,
connectors, and tasks. This document defines the target architecture and the
non-negotiable safety boundaries. The current MVP is the desktop companion's ancestor;
do **not** keep building everything inside Electron — see
[future-package-structure.md](future-package-structure.md) for where code should live.

## Components

### 1. Web app (`apps/web`)

- Browser/PWA client: chat, task list, reminders, memory review, audit review,
  connector settings, assistant identity settings.
- Talks only to the cloud backend over authenticated HTTPS.
- Cannot control the local computer. Actions that need the local machine are queued
  for the desktop companion, which still asks the user before executing.

### 2. Desktop companion (`apps/desktop`)

- Evolves from the current Electron MVP.
- The only component allowed to touch the local machine: files/folders, local
  Excel files, browser automation, desktop automation, local STT/TTS, tray.
- Owns **local-first/private mode**: with cloud off (the default), it works fully
  offline against local memory and local/mock providers — exactly like the MVP today.
- Re-checks permissions in its own process for every action; never trusts a remote
  instruction as pre-authorized.

### 3. Cloud backend (`apps/api`)

- Accounts and auth (user + company workspace), device pairing, session management.
- Task queue and scheduler (reminders, follow-ups, recurring reports).
- Hosts connector services that need a server (OAuth callbacks, WhatsApp Business
  webhooks, calendar push notifications).
- Stores only data the user explicitly approved for sync, encrypted at rest.
- Does not exist yet. Until it does, nothing in the codebase may assume it.

### 4. Connector services (`packages/connectors`)

- Email (Gmail / Graph / IMAP), calendar, Google Sheets, WhatsApp Business,
  browser, filesystem. Same interface whether invoked locally or from the cloud.
- Each connector declares the permission categories it needs and the risk level of
  each operation; the permission engine gates every call.

## Local memory vs cloud memory

| | Local memory | Cloud memory |
|---|---|---|
| Location | Encrypted SQLite on the device (OS-keychain key) | Backend DB, encrypted at rest |
| Default | ON — everything starts here | OFF — exists only after explicit opt-in |
| Contents | Whatever the user approves saving | Only items the user marked for sync |
| Visibility | Memory screen: view/edit/export/delete | Same controls from web and desktop |
| Deletion | Immediate local delete | Delete propagates; backend honors hard delete |

Sensitive-looking content (cards, OTPs, secrets) stays blocked from automatic capture
in both tiers (`packages/core/src/memory/encryption.ts` heuristics).

## Sync model

- Sync is **selective and visible**: before the first sync, the app shows exactly
  which item categories will be uploaded; the approval is written to the audit log.
- Device-scoped data (local file paths, desktop automation scripts) never syncs.
- Conflict rule: last-writer-wins per item, with both versions kept in history so
  nothing is silently lost.
- Local-only mode is a master kill switch on the device — when ON, the desktop
  companion makes no cloud calls at all (same semantics as today's provider gate).

## Permission model

- One permission engine semantics across all surfaces (the existing
  `packages/core/src/permissions` model): category → granted/denied, default **deny**.
- Granting a permission is never the same as confirming an action: high-risk actions
  (send message/email, delete/change files, purchase/pay, install, OS settings,
  share data externally) require a fresh confirmation **on the device where the
  action runs**, every time.
- Cloud-initiated tasks (e.g. a scheduled reminder that wants to send an email)
  produce *pending actions*, not actions. A human approves them on web or desktop.

## Audit log model

- Every surface writes structured audit entries: timestamp, actor
  (`user | agent | background`), action name, risk, detail JSON, result.
- Desktop keeps its local audit log even when cloud sync is on; the cloud holds a
  merged view. Neither side can delete the other's entries.
- Identity changes, provider approvals, sync approvals, wake-mode toggles, and
  every connector action are all auditable events.

## Assistant identity / wake name model

See [assistant-identity.md](assistant-identity.md) for the full rationale. Summary:

- The assistant's name is chosen by the user/company at setup — there is **no fixed
  global assistant name**. Examples: Tara, Nova, Riva, Arya, Vani.
- Wake phrase derives from the name: "Hey <assistant name>". When wake mode exists
  (Phase 9), the assistant responds **only** to its configured wake name and ignores
  all other voice triggers — required for offices where many assistants coexist.
- Identity = `assistantName`, `wakePhrase`, `voiceStyle`, optional `companyLabel`.
  Stored locally first (`packages/core/src/identity/`); synced to the workspace
  account only after the cloud backend exists and the user approves sync.
- Common names that collide with other ecosystems (Alexa, Siri, Google, Computer,
  Assistant, …) trigger a warning before they can be chosen.

## Voice style model

- Voice style is part of identity: `female | male | neutral` (default neutral).
- When TTS ships, voice style selects the speech voice; until then it may inform
  chat tone/personality labels only.
- Editable anytime in Settings; changes are audit-logged like name changes.
- Raw voice audio is not recorded or retained by default; STT output may be kept
  only as normal chat history.

## WhatsApp limits (honest constraints)

- **WhatsApp Business Cloud API** is the only stable, official integration path —
  and its webhooks require the cloud backend, so full support lands at Phase 7.
- **Personal WhatsApp** has no stable official public API for reading all chats.
  Supported honest routes: manual chat export/import, or opt-in desktop observation
  that is visible (tray badge), pausable, audited, and acknowledged as fragile.
- Sending any WhatsApp message requires per-message confirmation.

## Excel / file handling

- Local Excel/CSV files are parsed **on the device** by the desktop companion;
  file contents are not uploaded unless the user explicitly shares them with a
  cloud provider or sync.
- Google Sheets access goes through an OAuth connector with read vs write as
  separate permission grants.
- File writes never overwrite existing files without confirmation (the existing
  `LocalFilesystemConnector` rule generalizes to all file tools).

## Security boundaries

1. **Renderer ↔ main:** the Electron renderer keeps `contextIsolation: true`,
   no `nodeIntegration`, strict CSP; all privileged work stays in the main process.
2. **Device ↔ cloud:** mutual auth (device pairing), TLS, and the local-only kill
   switch. The device shows what data leaves it before it leaves.
3. **Cloud ↔ connectors:** connector tokens live server-side in a secrets store,
   scoped per user/workspace; the web client never sees raw tokens.
4. **Agent ↔ tools:** the orchestrator proposes plans; execution re-validates
   permissions and goes through confirmation UI. This split
   (`turn()` vs `executePlan()`) must survive every refactor.
5. **No hidden monitoring** anywhere in the stack: background activity is opt-in,
   visible, pausable, and logged — on every surface, not just desktop.

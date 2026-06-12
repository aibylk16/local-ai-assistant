# Product Roadmap — From Desktop MVP to Hybrid AI Employee

This roadmap upgrades the product direction: the goal is no longer "a desktop chat app"
but a full **AI employee/assistant** that works across web, desktop, email, spreadsheets,
files, browser, WhatsApp (within platform limits), reminders, and voice — under the same
permission, confirmation, audit, and privacy rules the MVP already enforces.

Every phase below inherits the [Core Product Rules](../README.md#core-product-rules).
No phase is allowed to weaken them. See [hybrid-architecture.md](hybrid-architecture.md)
for the target architecture and [assistant-identity.md](assistant-identity.md) for the
identity/wake-name model.

## Phase 1 — Local desktop MVP *(current, mostly done)*

- Electron + React desktop app for Windows/macOS.
- Chat, voice screens, permission center, encrypted local memory, audit log,
  mock email connector, WhatsApp adapter boundaries, background worker with tray.
- Pluggable `ModelProvider` with gated OpenAI/Anthropic cloud providers behind
  explicit approval + local-only kill switch.
- Status: scaffold complete, CI green, provider gating merged.

## Phase 2 — Custom assistant identity + setup wizard

- First-run setup wizard: assistant name → wake phrase preview ("Hey <name>") →
  voice style (female / male / neutral) → optional company/user label.
- Common-name warning (Alexa, Siri, Google, Computer, Assistant, …) so offices
  don't pick wake names that collide with other devices or other desks.
- Settings screen to edit name/voice style anytime; every change audit-logged.
- Identity stored locally first; cloud sync only after Phase 4 exists and the
  user approves sync.
- The core data model for this phase is already scaffolded:
  `packages/core/src/identity/`.

## Phase 3 — Web app / PWA

- Read-mostly companion at first: chat, memory review, audit review, task list.
- Installable PWA so it works on phones without app-store distribution.
- No local-computer control from the web app — that stays with the desktop companion.

## Phase 4 — Cloud backend + auth

- Account system (user + company/workspace), session auth, device pairing.
- Task queue, connector orchestration, secure sync of *approved* data only.
- Local-first remains the default: nothing syncs until the user opts in, and the
  app must show exactly what will be sent before the first sync.
- Cloud-side audit log mirrors the local one; neither can be silently disabled.

## Phase 5 — Email + calendar connectors (real)

- Gmail (OAuth2), Microsoft Graph, IMAP/SMTP — replacing the MVP placeholders.
- Calendar read + event drafts. Missed-reply and pending-action detection on real mail.
- Drafts always require confirmation before sending. No auto-send tier in this phase.

## Phase 6 — Excel / Google Sheets workflows

- Read/summarize/transform spreadsheets locally (xlsx parsing in the desktop app).
- Google Sheets connector via OAuth for cloud sheets.
- Report generation (recurring summaries, e.g. weekly sales digest) as draft outputs
  the user reviews before they go anywhere.

## Phase 7 — WhatsApp Business / manual import support

- WhatsApp Business Cloud API connector (requires the Phase 4 backend for webhooks).
- Manual chat export/import for personal accounts.
- Honest limits stay documented: personal WhatsApp has no stable official public API
  for full chat reading; desktop observation remains opt-in, visible, and fragile.
- Sending any WhatsApp message always requires confirmation.

## Phase 8 — Desktop automation / browser automation

- Playwright-driven browser automation and OS accessibility-API desktop automation.
- Every automation run is permission-gated, previewed ("here is what I will click"),
  confirmable, cancellable, and audit-logged step by step.
- No automation against banking/payment flows without per-action confirmation.

## Phase 9 — Voice assistant / wake mode with custom wake name

- Local STT (Whisper-class) and TTS honoring the configured voice style.
- Wake mode listens only for the *configured* wake phrase ("Hey <assistant name>")
  and ignores everything else; no fixed global wake word, ever.
- Wake mode ships only with: explicit opt-in permission, a visible always-on
  listening indicator, a hardware-style mute toggle, and audit entries for
  activation/deactivation. Raw audio is not recorded or retained by default.

## Phase 10 — Task queue + proactive reminders

- Durable task queue (local first, cloud-synced after Phase 4 opt-in).
- Daily follow-ups, recurring reminders, "nudge me if no reply in 2 days".
- Proactive messages from the assistant are notifications/drafts — acting on them
  still goes through the normal permission + confirmation flow.

## Phase 11 — Enterprise / security hardening

- Company workspaces: per-company assistant identity, role-based permissions,
  admin-visible (but not user-hidden) audit exports.
- SSO, device management, secrets management review, signed installers,
  penetration testing, data-retention and deletion guarantees.
- Compliance documentation (what is stored where, encryption at rest/in transit).

## Sequencing rules

1. Phases may overlap, but a phase must not ship if it bypasses the permission
   engine, confirmation modals, or audit log to hit a deadline.
2. Anything that moves data off the device depends on Phase 4's "show and approve
   what is sent" flow.
3. Wake mode (Phase 9) depends on identity (Phase 2) — there is no wake mode
   without a user-chosen wake name.

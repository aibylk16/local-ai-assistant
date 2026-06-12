# Assistant Identity — Custom Name, Wake Phrase, Voice Style

## Why the assistant name must be customizable

This product is meant for offices and companies, not just one person at home.
If every installation shipped with the same fixed assistant name, then in any room
with more than one desk, saying the wake phrase would trigger **every** assistant in
earshot. That is unacceptable for office use, and it is also why a fixed global name
is a product risk, not just a preference:

- **Cross-talk:** ten desks, ten assistants, one shared name → one spoken command
  activates all of them.
- **Ecosystem collisions:** names like "Alexa", "Siri", or "Google" would trigger
  (or be triggered by) other devices already present in homes and offices.
- **Identity/branding:** companies want "their" assistant ("Hey Tara from Acme"),
  not a generic one.

Therefore: **no fixed global assistant name, ever.** Each user/company chooses a name
at setup. Example names: Tara, Nova, Riva, Arya, Vani — any reasonable name works.

## How the wake phrase works

- The wake phrase is derived from the configured name: **"Hey <assistant name>"**.
- When wake mode is implemented (roadmap Phase 9), the assistant must respond
  **only** to its configured wake phrase. If the spoken name does not match the
  configured name, the voice input is ignored entirely — not processed, not logged
  as a command, not answered.
- Wake-phrase matching should be tolerant of pronunciation variance for the
  *configured* name only — never a fuzzy match broad enough to catch other names.

## No always-listening mode (yet)

Wake mode does not exist in the current build, and it must not be added until all of
the following exist together:

1. Explicit opt-in permission (its own permission category, default OFF).
2. A visible, persistent listening indicator while the microphone is open.
3. A user-accessible mute/pause control.
4. Audit log entries for wake-mode activation, deactivation, and each wake event.
5. No raw-audio recording or retention by default.

Until then, voice input remains push-to-talk on the Voice screen.

## Voice style choices

During setup (after choosing the name), the user picks a voice style:

- **Female voice**
- **Male voice**
- **Neutral voice** (default)

The style is stored as part of the identity settings and is used:

- for TTS voice selection once voice output ships;
- for chat tone/personality labels where appropriate (labels only — it must not
  change what the assistant is permitted to do).

Both the name and the voice style are editable at any time in Settings.

## Common-name warning logic

When the user enters a name, the app checks it (case-insensitively) against a
reserved/risky list and shows a warning before accepting it:

- `Alexa`, `Siri`, `Google`, `Cortana`, `Bixby`, `Echo` — collide with other
  voice ecosystems and will cause cross-device triggering.
- `Computer`, `Assistant`, `AI`, `Hey` — too generic; spoken constantly in normal
  office conversation, causing false wakes.

The warning explains the risk and lets the user proceed anyway (their choice), but
the choice and the shown warning are recorded in the audit log. The list lives in
`packages/core/src/identity/common-names.ts` and is intentionally easy to extend.

Validation also rejects outright-invalid names: empty, whitespace-only, longer than
40 characters, or containing control characters.

## Storage model

- **Local first.** Identity is stored in the local SQLite database
  (`identity_settings` table) next to the other settings — implemented in
  `packages/core/src/identity/store.ts`.
- **Cloud later.** Once the cloud backend exists (roadmap Phase 4), identity can
  sync to the user/workspace account so the web app shows the same assistant —
  but only after the user approves sync, like all other synced data.
- Until first-run setup completes, the identity is marked *unconfigured*; the UI
  should route the user into the setup wizard rather than inventing a default name.

## Audit model

Every identity change writes an audit entry (action `identity.update`) recording:

- which fields changed (old → new for name, voice style, company label),
- the actor (always `user` — the agent must never rename itself),
- any common-name warning that was shown and overridden.

## Future setup wizard behavior (roadmap Phase 2)

First-run wizard order:

1. **Assistant name** — text input, live wake-phrase preview ("Hey Tara"),
   common-name warning inline when applicable.
2. **Voice style** — female / male / neutral choice.
3. **Company/user label** — optional ("Acme Pvt Ltd", "Laxmikant's desk").
4. Existing steps (permissions overview, AI provider choice) follow.

A future **Settings → Assistant Identity** screen exposes the same fields plus a
wake-phrase preview and, once TTS exists, a "Test voice" button that speaks one
sample sentence in the selected style.

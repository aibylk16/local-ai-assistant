# Future Package Structure — Hybrid Monorepo

As the product grows from desktop MVP into the hybrid AI employee
(see [hybrid-architecture.md](hybrid-architecture.md)), the monorepo should evolve
toward the structure below. Do not build new surface-specific features inside
`apps/desktop` if they belong in a shared package or a different app.

```text
local-ai-assistant/
  apps/
    web/                  # Browser/PWA client (roadmap Phase 3)
                          #   chat, tasks, reminders, memory + audit review,
                          #   identity settings. Talks only to apps/api.
    desktop/              # Electron companion (exists today)
                          #   the ONLY surface with local-computer access:
                          #   files, local Excel, desktop/browser automation,
                          #   local STT/TTS, tray. Owns local-first mode.
    api/                  # Cloud backend (roadmap Phase 4)
                          #   accounts/auth, workspaces, device pairing,
                          #   task queue, connector webhooks, approved-data sync.
  packages/
    core/                 # (exists today) agent orchestrator, permission engine,
                          #   audit log, memory service, tool registry, providers,
                          #   identity settings model. Surface-agnostic, no UI.
    connectors/           # (exists today) email, calendar, sheets, whatsapp,
                          #   browser, filesystem. Same interfaces local or cloud.
    automation/           # Desktop + browser automation (roadmap Phase 8):
                          #   step plans, previews, per-step audit. Built on
                          #   Playwright / OS accessibility APIs. Permission-gated.
    shared-ui/            # React components shared by apps/web and apps/desktop:
                          #   ConfirmationModal, audit views, memory views,
                          #   identity settings form, permission center.
    voice/                # STT/TTS abstraction (roadmap Phase 9): push-to-talk now,
                          #   wake-word engine later (custom wake name only),
                          #   voice-style selection honoring identity settings.
    identity/             # If identity logic outgrows packages/core/src/identity,
                          #   promote it here: identity model, wake-name validation,
                          #   common-name warnings, (later) workspace identity sync.
    background-worker/    # (exists today) opt-in, visible, pausable monitoring.
```

## Migration rules

1. **Move, don't fork.** When a feature is needed by a second surface, extract it
   from `apps/desktop` into a package — don't copy it.
2. **`packages/core` stays UI-free and Node/browser-neutral** where possible, so
   `apps/api` and `apps/web` can reuse the same models (permission semantics,
   audit shapes, identity types).
3. **Safety modules travel with the code.** Any package that executes actions must
   depend on the permission engine and audit service from `core` — no package gets
   its own "lite" permission model.
4. **`apps/desktop` keeps exclusive rights to the local machine.** Neither
   `apps/web` nor `apps/api` may gain direct file/automation access; they enqueue
   pending actions for the desktop companion instead.
5. New packages start as folders under the existing npm-workspaces setup; no build
   tooling change is required to begin (`packages/*` is already a workspace glob).

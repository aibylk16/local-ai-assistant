# Handoff - 2026-06-12 - Codex Web Preview

## Current status

Added the first online web companion app under `apps/web` plus a GitHub Pages deployment workflow. This is a safe browser preview, not a replacement for the desktop companion. It supports custom assistant identity, wake phrase preview, voice style selection, provider safety toggles, and mock chat in browser local storage.

## Files changed

- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `.github/workflows/deploy-web.yml`
- `README.md`
- `CHANGELOG.md`
- `docs/handoffs/2026-06-12-codex-web-preview.md`

## Decisions made

- Use GitHub Pages first because it avoids a separate hosting account.
- Keep the web app safe and mock-only for now. It does not store API keys, call cloud providers, read WhatsApp, or control the local computer.
- Store preview identity/provider choices in browser `localStorage`.
- Keep local computer control assigned to the desktop companion, as documented in the hybrid architecture.

## Open TODOs

- Enable GitHub Pages in repository settings if GitHub requires it.
- Wait for the `Deploy Web Assistant` workflow to pass.
- Open the Pages URL and test identity setup plus mock chat.
- Later add a real backend under `apps/api` for login, secure sync, provider calls, and connectors.

## Risks / blockers

- GitHub Pages may require repository Pages settings to use GitHub Actions as the source.
- If the repo is private, GitHub Pages availability depends on the account/plan.
- Web-only mode cannot perform local Windows/Mac automation. That still needs the desktop companion.

## Suggested next step

Push the web preview and watch the `Deploy Web Assistant` workflow. If it passes, use the deployed URL for online testing; if it fails, inspect the Actions log and patch the workflow.

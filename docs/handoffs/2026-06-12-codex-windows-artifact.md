# Handoff - 2026-06-12 - Codex Windows Artifact Workflow

## Current status

Added a GitHub Actions workflow that builds a downloadable Windows desktop app artifact on GitHub. This keeps dependency installation, native rebuild, tests, and packaging off the local PC.

## Files changed

- `.github/workflows/build-windows-app.yml`
- `README.md`
- `CHANGELOG.md`
- `docs/handoffs/2026-06-12-codex-windows-artifact.md`

## Decisions made

- Build only on `windows-latest` because the user is testing from Windows first.
- Run `npm install`, `npm run rebuild:native`, and `npm test` before packaging so the artifact is not produced from a failing build.
- Package with `npm run package:win -w apps/desktop`, which uses the existing Electron Builder config.
- Set `CSC_IDENTITY_AUTO_DISCOVERY=false` so Electron Builder does not attempt Windows code-signing discovery in CI.
- Upload everything under `apps/desktop/release/**` as the `local-ai-assistant-windows` artifact.

## Open TODOs

- Push this workflow and let GitHub Actions run.
- If it passes, download the artifact from the `Build Windows App Artifact` workflow run.
- If packaging fails, inspect the Actions log and patch the package config.

## Risks / blockers

- The installer will be unsigned, so Windows may show a security warning.
- Electron Builder may expose packaging issues that `npm run build` does not catch.
- Real cloud provider testing still requires launching the app with `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set.

## Suggested next step

Push the workflow, wait for the GitHub Actions run, then download the `local-ai-assistant-windows` artifact and test the app manually.

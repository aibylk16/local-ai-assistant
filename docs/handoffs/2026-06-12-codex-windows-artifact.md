# Handoff - 2026-06-12 - Codex Windows Artifact Workflow

## Current status

Added a GitHub Actions workflow that builds a downloadable Windows runnable app artifact on GitHub. This keeps dependency installation, native rebuild, tests, and app build off the local PC.

The first installer-packaging attempt failed because Electron Builder could not find its `7zip-bin` executable in the expected workspace path. The workflow now uploads a runnable dev-mode bundle instead of an installer.

## Files changed

- `.github/workflows/build-windows-app.yml`
- `README.md`
- `CHANGELOG.md`
- `docs/handoffs/2026-06-12-codex-windows-artifact.md`

## Decisions made

- Build only on `windows-latest` because the user is testing from Windows first.
- Run `npm install`, `npm run rebuild:native`, `npm test`, and `npm run build` before producing the artifact.
- Upload a `windows-runner` folder containing source, built output, `node_modules`, and `START_LOCAL_AI_ASSISTANT.cmd`.
- Use the artifact name `local-ai-assistant-windows-runner`.
- Defer Electron Builder installer packaging until the MVP is more stable.

## Open TODOs

- Push this workflow and let GitHub Actions run.
- If it passes, download the artifact from the `Build Windows Runnable Artifact` workflow run.
- Extract the artifact and double-click `START_LOCAL_AI_ASSISTANT.cmd`.

## Risks / blockers

- The runnable bundle still requires Node.js on the PC.
- The artifact may be large because it includes `node_modules`.
- This is not a signed installer; it is a dev-mode runner for testing.
- Real cloud provider testing still requires launching the app with `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set.

## Suggested next step

Push the workflow, wait for the GitHub Actions run, then download the `local-ai-assistant-windows-runner` artifact and test the app manually.

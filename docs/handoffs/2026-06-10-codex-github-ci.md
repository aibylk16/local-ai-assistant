# Handoff - 2026-06-10 - Codex GitHub CI

## Current status

Claude's MVP scaffold was checked without running local install/test/dev commands. The project structure and handoff file are present. A local `node_modules` folder exists, likely from the interrupted install attempt, but it is ignored by `.gitignore` and was not used for verification.

Added GitHub-side verification so dependency install and build checks can happen on GitHub instead of this PC.

Attempted to push to `https://github.com/aibylk16/local-ai-assistant.git`, but GitHub returned `Repository not found.` The local repo and commit are ready; pushing needs an existing repository URL and authentication.

## Files changed

- `.github/workflows/ci.yml`
- `docs/github-install.md`
- `docs/handoffs/2026-06-10-codex-github-ci.md`
- `CHANGELOG.md`

## Decisions made

- Use GitHub Actions for Windows and macOS only, matching the product target platforms.
- Use `npm install` in CI because there is no committed `package-lock.json`.
- Run `npm run rebuild:native` before tests/build so `better-sqlite3` is rebuilt for Electron.
- Do not run `npm install`, `npm test`, or `npm run dev` locally after the user requested GitHub-only install.

## Open TODOs

- Create or choose a GitHub repository and push/upload this project.
- If using the guessed target, create `https://github.com/aibylk16/local-ai-assistant` first or provide the correct repository URL.
- Run the `Verify MVP Scaffold` workflow from the GitHub Actions tab.
- If the workflow creates or reports the need for a lockfile, commit `package-lock.json` and change the install step to `npm ci`.
- Optionally remove the local `node_modules` folder from this PC.

## Risks / blockers

- This workspace is not currently connected to a GitHub repository.
- GitHub CLI is not installed on this PC.
- Push to `https://github.com/aibylk16/local-ai-assistant.git` failed with `Repository not found.`
- Actual runtime status remains unverified until the GitHub Actions workflow runs.

## Suggested next step

Create the GitHub repository or provide the correct repo URL, then push the local `main` branch and run the `Verify MVP Scaffold` workflow.

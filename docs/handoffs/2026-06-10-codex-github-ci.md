# Handoff - 2026-06-10 - Codex GitHub CI

## Current status

Claude's MVP scaffold was checked without running local install/test/dev commands. The project structure and handoff file are present. A local `node_modules` folder exists, likely from the interrupted install attempt, but it is ignored by `.gitignore` and was not used for verification.

Added GitHub-side verification so dependency install and build checks can happen on GitHub instead of this PC.

The repository now exists at `https://github.com/aibylk16/local-ai-assistant.git`, and the local `main` branch tracks `origin/main`.

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

- Push the JWT detector fix.
- Re-run or wait for the `Verify MVP Scaffold` workflow from the GitHub Actions tab.
- If the workflow creates or reports the need for a lockfile, commit `package-lock.json` and change the install step to `npm ci`.
- Optionally remove the local `node_modules` folder from this PC.

## Risks / blockers

- This workspace is connected to `https://github.com/aibylk16/local-ai-assistant.git`.
- GitHub CLI is not installed on this PC.
- Actual runtime status remains unverified until the GitHub Actions workflow runs successfully.
- First GitHub Actions run failed on both Windows and macOS in `packages/core/src/__tests__/memory.test.ts > looksSensitive > flags OTPs and JWTs`; `packages/core/src/memory/encryption.ts` was updated to catch normal JWT-shaped tokens with shorter first segments.

## Suggested next step

Push the JWT detector fix, then re-run or wait for the `Verify MVP Scaffold` workflow and review any remaining failures.

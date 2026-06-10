# GitHub Install and Verification

Use this when you want dependency installation and verification to happen on GitHub instead of on the local PC.

## What Runs on GitHub

The workflow at `.github/workflows/ci.yml` runs on Windows and macOS:

1. `npm install`
2. `npm run rebuild:native`
3. `npm test`
4. `npm run build`

This checks the same MVP scaffold Claude described, including the native `better-sqlite3` rebuild required by Electron.

## How to Use

1. Create a GitHub repository.
2. Upload or push this project folder to that repository.
3. Open the repository on GitHub.
4. Go to `Actions`.
5. Select `Verify MVP Scaffold`.
6. Run it manually with `Run workflow`, or push to `main` / `master`.

## Notes

- This workspace is not currently connected to a GitHub repository.
- GitHub CLI is not installed on this PC, so repository creation cannot be done from here unless GitHub is configured separately.
- A local `node_modules` folder may exist from an interrupted install. It is ignored by `.gitignore` and should not be uploaded to GitHub.
- The workflow uses `npm install` because there is no committed `package-lock.json` yet. After GitHub or a trusted build environment creates a lockfile, commit it and switch the workflow to `npm ci`.

import type { BrowserAction, BrowserConnector } from './types.js'

/**
 * Playwright browser automation — PLACEHOLDER.
 *
 * To implement:
 *   - Install `playwright` and the chromium browser via `npx playwright install chromium`.
 *   - Run only when `browser.automation` permission is granted.
 *   - Show a visible "automation running" tray indicator while a session is active.
 *   - For any action that submits a form or makes a purchase, require an
 *     additional in-app confirmation modal even if the broader permission
 *     is granted.
 */
export class PlaywrightConnector implements BrowserConnector {
  id = 'browser.playwright' as const
  label = 'Playwright (not configured)'
  async ready(): Promise<boolean> {
    return false
  }
  async run(_actions: BrowserAction[]) {
    return { ok: false, error: 'PlaywrightConnector not implemented yet.' }
  }
}

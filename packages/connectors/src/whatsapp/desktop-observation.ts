import type {
  WhatsAppAdapter,
  WhatsAppDraft,
  WhatsAppMessage,
} from './types.js'

/**
 * Desktop observation adapter — PLACEHOLDER and DISABLED BY DEFAULT.
 *
 * DO NOT enable this adapter without:
 *   1. Explicit user grant of `screen.observe` AND `accessibility`.
 *   2. A visible monitoring indicator in the system tray.
 *   3. An audit log entry for every observation cycle.
 *
 * This adapter watches WhatsApp Desktop via OS accessibility APIs. It is
 * inherently fragile (any WhatsApp UI change can break it) and should be
 * treated as a best-effort fallback, not a primary source of truth.
 *
 * To implement (per platform):
 *   - macOS: AXUIElement via the `node-mac-permissions` and a native AX
 *     bridge. Requires the user to add the app to "Accessibility" in
 *     System Settings > Privacy & Security.
 *   - Windows: UI Automation via `winax` or a native Rust/C++ bridge with
 *     `IUIAutomation`. Requires the user to allow accessibility access.
 *   - The app must show a persistent tray badge while observation is active.
 *
 * Sending: not supported here. To send, switch to the Business Cloud
 * adapter or have the user send manually. The audit log must reflect that
 * no Send action is ever invoked from this adapter.
 */
export class DesktopObservationAdapter implements WhatsAppAdapter {
  id = 'whatsapp.observation' as const
  label = 'WhatsApp Desktop Observation (off by default)'

  /** Off by default. The Permission Center must explicitly enable this. */
  private enabled = false

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  async ready(): Promise<boolean> {
    return false // Until a real implementation lands.
  }

  async listRecent(): Promise<WhatsAppMessage[]> {
    if (!this.enabled) {
      throw new Error(
        'Desktop observation is disabled. Enable screen.observe + accessibility in the Permission Center first.',
      )
    }
    throw new Error('DesktopObservationAdapter not implemented yet.')
  }

  async draftReply(): Promise<WhatsAppDraft> {
    throw new Error('DesktopObservationAdapter cannot draft via observation.')
  }

  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error(
      'Sending via desktop observation is not supported. Use the Business Cloud adapter or send manually.',
    )
  }
}

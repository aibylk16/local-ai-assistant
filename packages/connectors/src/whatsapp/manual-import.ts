import type {
  WhatsAppAdapter,
  WhatsAppDraft,
  WhatsAppMessage,
} from './types.js'

/**
 * Manual chat export/import adapter — PLACEHOLDER.
 *
 * WhatsApp lets users export a chat as a .txt (or .zip with media) from the
 * mobile app. This adapter is meant to parse such an export and surface the
 * messages locally. Importantly, it is NOT real-time: the user re-imports
 * whenever they want updated context.
 *
 * To implement:
 *   - Accept a .txt or .zip via the Connectors UI.
 *   - Parse the standard "[DD/MM/YY, HH:MM] Sender: message" format.
 *     (Format differs slightly by phone locale — handle DD/MM/YYYY and MM/DD/YYYY.)
 *   - Persist messages to message_threads + a per-import account row.
 *
 * `sendDraft` is intentionally unsupported here — there is no way to send a
 * personal-WhatsApp message via an import file. The UI must hide the Send
 * button for threads sourced from this adapter.
 */
export class ManualImportAdapter implements WhatsAppAdapter {
  id = 'whatsapp.manual' as const
  label = 'WhatsApp Manual Export (no file imported)'

  private messages: WhatsAppMessage[] = []

  async ready(): Promise<boolean> {
    return this.messages.length > 0
  }

  async listRecent(limit = 100): Promise<WhatsAppMessage[]> {
    return this.messages.slice(-limit).reverse()
  }

  async draftReply(originalId: string, bodyText: string): Promise<WhatsAppDraft> {
    const original = this.messages.find((m) => m.externalId === originalId)
    if (!original) throw new Error(`No such message: ${originalId}`)
    return { threadId: original.threadId, to: original.from, bodyText }
  }

  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error(
      'Manual import adapter cannot send WhatsApp messages. Use the Business Cloud adapter or send manually.',
    )
  }

  /**
   * Public hook for the UI to load a parsed export. Parsing itself lives
   * in the renderer/main process (file picker, locale handling).
   */
  loadParsedMessages(messages: WhatsAppMessage[]): void {
    this.messages = messages
  }
}

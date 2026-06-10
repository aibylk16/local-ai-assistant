/**
 * IMPORTANT REALITY CHECK
 * -----------------------
 * Personal WhatsApp has NO stable official public API for reading all chats.
 * This is not a limitation of this codebase — it is a platform-level reality.
 *
 * The three adapters below represent the three honest routes available today:
 *
 *  1. WhatsApp Business Cloud API  — works only for business accounts.
 *  2. Manual chat export/import    — user exports a chat, app imports it.
 *  3. Desktop observation          — screen/accessibility-driven, fragile.
 *
 * None of these adapters may send a message without explicit user
 * confirmation at the UI layer.
 */

export type WhatsAppAdapterId =
  | 'whatsapp.business'
  | 'whatsapp.manual'
  | 'whatsapp.observation'

export interface WhatsAppMessage {
  externalId: string
  threadId: string
  from: string
  to: string
  bodyText: string
  receivedAt: string
  unread: boolean
  fromMe: boolean
}

export interface WhatsAppDraft {
  threadId: string
  to: string
  bodyText: string
}

export interface WhatsAppAdapter {
  id: WhatsAppAdapterId
  label: string
  /** Does this adapter have what it needs (credentials, file, accessibility grant) to function? */
  ready(): Promise<boolean>
  listRecent(limit?: number): Promise<WhatsAppMessage[]>
  draftReply(originalId: string, bodyText: string): Promise<WhatsAppDraft>
  /** REQUIRES user confirmation upstream. Do not call from the agent directly. */
  sendDraft(draft: WhatsAppDraft): Promise<{ ok: boolean; messageId?: string }>
}

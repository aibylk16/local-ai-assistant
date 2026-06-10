import type {
  WhatsAppAdapter,
  WhatsAppDraft,
  WhatsAppMessage,
} from './types.js'

/**
 * WhatsApp Business Cloud API adapter — PLACEHOLDER.
 *
 * This is the only OFFICIAL route for programmatic WhatsApp messaging. It is
 * intended for business accounts (registered phone numbers under a Meta
 * Business account). It cannot read personal chats.
 *
 * To implement:
 *   - Register a phone number on the WhatsApp Business Platform.
 *   - Obtain an access token (stored encrypted via safeStorage).
 *   - Use POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages to send.
 *   - Receive incoming via a webhook — the desktop app cannot host one, so
 *     a server-side relay or polling proxy is needed. Document this clearly.
 *   - NEVER send without UI confirmation, regardless of whether template
 *     messages are pre-approved.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export class BusinessCloudAdapter implements WhatsAppAdapter {
  id = 'whatsapp.business' as const
  label = 'WhatsApp Business Cloud (not configured)'

  async ready(): Promise<boolean> {
    return false
  }
  async listRecent(): Promise<WhatsAppMessage[]> {
    throw new Error('BusinessCloudAdapter not implemented yet.')
  }
  async draftReply(): Promise<WhatsAppDraft> {
    throw new Error('BusinessCloudAdapter not implemented yet.')
  }
  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error('BusinessCloudAdapter not implemented yet.')
  }
}

import type { EmailConnector, EmailDraft, EmailMessage } from './types.js'

/**
 * Gmail API adapter — PLACEHOLDER.
 *
 * To implement:
 *   - Use Google OAuth2 with the `gmail.readonly` and `gmail.send` scopes
 *     (the latter only if the user has granted email.send permission).
 *   - Store the refresh token in the OS keychain via safeStorage.
 *   - `listRecent` → users.messages.list + users.messages.get (format=metadata).
 *   - `draftReply` → users.drafts.create.
 *   - `sendDraft` → users.drafts.send. NEVER called without UI confirmation.
 *
 * See: https://developers.google.com/gmail/api
 */
export class GmailConnector implements EmailConnector {
  id = 'gmail' as const
  label = 'Gmail (not configured)'

  async ready(): Promise<boolean> {
    return false
  }

  async listRecent(): Promise<EmailMessage[]> {
    throw new Error('GmailConnector not implemented yet. See file for instructions.')
  }

  async draftReply(): Promise<EmailDraft> {
    throw new Error('GmailConnector not implemented yet.')
  }

  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error('GmailConnector not implemented yet.')
  }
}

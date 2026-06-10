import type { EmailConnector, EmailDraft, EmailMessage } from './types.js'

/**
 * IMAP adapter — PLACEHOLDER.
 *
 * To implement:
 *   - Use the `imapflow` or `node-imap` package.
 *   - Use `nodemailer` for SMTP sending.
 *   - Credentials stored encrypted via safeStorage. NEVER store plaintext.
 *   - `listRecent` → IMAP SEARCH/FETCH for the last N messages.
 *   - `sendDraft` → SMTP via nodemailer. NEVER called without UI confirmation.
 *
 * Note: many providers (Gmail, Outlook) require app passwords or modern auth
 * for IMAP/SMTP. Document this in the UI before the user enables it.
 */
export class ImapConnector implements EmailConnector {
  id = 'imap' as const
  label = 'IMAP / SMTP (not configured)'

  async ready(): Promise<boolean> {
    return false
  }
  async listRecent(): Promise<EmailMessage[]> {
    throw new Error('ImapConnector not implemented yet.')
  }
  async draftReply(): Promise<EmailDraft> {
    throw new Error('ImapConnector not implemented yet.')
  }
  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error('ImapConnector not implemented yet.')
  }
}

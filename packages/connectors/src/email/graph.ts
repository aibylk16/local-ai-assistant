import type { EmailConnector, EmailDraft, EmailMessage } from './types.js'

/**
 * Microsoft Graph (Outlook) adapter — PLACEHOLDER.
 *
 * To implement:
 *   - MSAL OAuth2 with `Mail.Read` and `Mail.Send`.
 *   - Store the refresh token in the OS keychain via safeStorage.
 *   - `listRecent` → GET /me/mailFolders/Inbox/messages
 *   - `draftReply` → POST /me/messages/{id}/createReply
 *   - `sendDraft` → POST /me/sendMail. NEVER called without UI confirmation.
 *
 * See: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */
export class GraphConnector implements EmailConnector {
  id = 'graph' as const
  label = 'Outlook / Microsoft 365 (not configured)'

  async ready(): Promise<boolean> {
    return false
  }
  async listRecent(): Promise<EmailMessage[]> {
    throw new Error('GraphConnector not implemented yet.')
  }
  async draftReply(): Promise<EmailDraft> {
    throw new Error('GraphConnector not implemented yet.')
  }
  async sendDraft(): Promise<{ ok: boolean; messageId?: string }> {
    throw new Error('GraphConnector not implemented yet.')
  }
}

export type EmailProviderId = 'mock' | 'gmail' | 'graph' | 'imap'

export interface EmailMessage {
  externalId: string
  threadId: string
  from: string
  to: string[]
  subject: string
  snippet: string
  bodyText: string
  receivedAt: string
  unread: boolean
  /** True if the user wrote/sent this message. */
  fromMe: boolean
}

export interface EmailDraft {
  threadId: string
  to: string[]
  subject: string
  bodyText: string
}

/**
 * Connector interface. Every adapter (mock/gmail/graph/imap) implements this.
 * Adapters MUST throw if called without their required permission having
 * already been granted at the engine level.
 *
 * Importantly, `sendDraft` is part of the interface but the agent MUST NOT
 * call it without an explicit user confirmation. The renderer is the only
 * code path allowed to trigger `sendDraft`.
 */
export interface EmailConnector {
  id: EmailProviderId
  label: string
  /**
   * Whether this connector can actually run in the current environment.
   * For mock: always true. For real connectors: false until OAuth is done.
   */
  ready(): Promise<boolean>
  listRecent(limit?: number): Promise<EmailMessage[]>
  draftReply(originalId: string, bodyText: string): Promise<EmailDraft>
  /** REQUIRES user confirmation upstream. Do not call this from the agent directly. */
  sendDraft(draft: EmailDraft): Promise<{ ok: boolean; messageId?: string }>
}

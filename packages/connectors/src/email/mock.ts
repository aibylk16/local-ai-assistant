import type { EmailConnector, EmailDraft, EmailMessage } from './types.js'

const FIXTURES: EmailMessage[] = [
  {
    externalId: 'm-1',
    threadId: 't-1',
    from: 'priya@example.com',
    to: ['me@example.com'],
    subject: 'Quote for the dashboard work',
    snippet: 'Sharing the revised quote — let me know if Tuesday works for kickoff.',
    bodyText:
      'Hi,\n\nSharing the revised quote attached. Let me know if Tuesday works for the kickoff call.\n\nThanks,\nPriya',
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    unread: true,
    fromMe: false,
  },
  {
    externalId: 'm-2',
    threadId: 't-2',
    from: 'raj@example.com',
    to: ['me@example.com'],
    subject: 'Re: Invoice March',
    snippet: "Got it, I'll wire the payment by Friday. Could you confirm the GST number once more?",
    bodyText:
      "Got it, I'll wire the payment by Friday. Could you confirm the GST number once more?",
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    unread: true,
    fromMe: false,
  },
  {
    externalId: 'm-3',
    threadId: 't-3',
    from: 'me@example.com',
    to: ['support@vendor.com'],
    subject: 'Account access issue',
    snippet: 'Following up — still locked out. Any update?',
    bodyText: 'Following up — still locked out. Any update?',
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    unread: false,
    fromMe: true,
  },
]

export class MockEmailConnector implements EmailConnector {
  id = 'mock' as const
  label = 'Mock Inbox (no network)'

  async ready(): Promise<boolean> {
    return true
  }

  async listRecent(limit = 50): Promise<EmailMessage[]> {
    return FIXTURES.slice(0, limit)
  }

  async draftReply(originalId: string, bodyText: string): Promise<EmailDraft> {
    const original = FIXTURES.find((m) => m.externalId === originalId)
    if (!original) throw new Error(`No such message: ${originalId}`)
    return {
      threadId: original.threadId,
      to: [original.from],
      subject: original.subject.startsWith('Re:')
        ? original.subject
        : `Re: ${original.subject}`,
      bodyText,
    }
  }

  /**
   * Mock send. In a real connector this would call Gmail/Graph/IMAP.
   * Even here, the agent MUST NOT call this without user confirmation —
   * the IPC layer enforces that.
   */
  async sendDraft(_draft: EmailDraft): Promise<{ ok: boolean; messageId?: string }> {
    return { ok: true, messageId: `mock-${Date.now()}` }
  }
}

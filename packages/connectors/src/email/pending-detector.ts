import type { EmailMessage } from './types.js'

export type ThreadState =
  | 'no_action'
  | 'needs_reply'
  | 'waiting'
  | 'replied'
  | 'follow_up'

export interface PendingThread {
  threadId: string
  lastMessage: EmailMessage
  state: ThreadState
  reason: string
  suggestedDraft?: string
}

/**
 * Heuristic pending-reply detector. This runs entirely locally on a list of
 * messages already fetched by a connector. No network calls, no LLM —
 * deliberately simple so the user can audit why a thread was flagged.
 *
 * A real product would replace this with a model-assisted classifier, but
 * the contract — that flagged threads still require user confirmation
 * before sending any reply — must not change.
 */
export class PendingReplyDetector {
  private static REPLY_HINTS = [
    /\bcould you\b/i,
    /\bcan you\b/i,
    /\bplease confirm\b/i,
    /\?\s*$/m,
    /\blet me know\b/i,
    /\bwhen (?:can|will) you\b/i,
    /\bwaiting for\b/i,
  ]
  private static FOLLOW_UP_HINTS = [
    /\bfollow(?:ing)?[- ]?up\b/i,
    /\bany update\b/i,
    /\bbumping this\b/i,
    /\bgentle reminder\b/i,
  ]

  detect(messages: EmailMessage[]): PendingThread[] {
    // Group by threadId, take the latest message.
    const byThread = new Map<string, EmailMessage>()
    for (const m of messages) {
      const cur = byThread.get(m.threadId)
      if (!cur || cur.receivedAt < m.receivedAt) byThread.set(m.threadId, m)
    }

    const results: PendingThread[] = []
    for (const [threadId, last] of byThread) {
      if (last.fromMe) {
        if (PendingReplyDetector.FOLLOW_UP_HINTS.some((re) => re.test(last.bodyText))) {
          results.push({
            threadId,
            lastMessage: last,
            state: 'follow_up',
            reason: 'Looks like you are chasing a reply.',
          })
        } else {
          results.push({
            threadId,
            lastMessage: last,
            state: 'waiting',
            reason: 'Your latest message has no reply yet.',
          })
        }
        continue
      }

      if (PendingReplyDetector.REPLY_HINTS.some((re) => re.test(last.bodyText))) {
        results.push({
          threadId,
          lastMessage: last,
          state: 'needs_reply',
          reason: 'Sender asked a question or made a request.',
          suggestedDraft: defaultDraft(last),
        })
        continue
      }

      results.push({
        threadId,
        lastMessage: last,
        state: 'no_action',
        reason: 'No clear request detected.',
      })
    }
    // Only return threads that actually want attention.
    return results.filter((r) => r.state !== 'no_action')
  }
}

function defaultDraft(m: EmailMessage): string {
  return `Hi ${friendlyName(m.from)},\n\nThanks for your note — I'll get back to you shortly with the details.\n\nBest,`
}

function friendlyName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local.charAt(0).toUpperCase() + local.slice(1)
}

import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ConfirmationModal } from '../components/ConfirmationModal.js'

interface EmailMessage {
  externalId: string
  threadId: string
  from: string
  to: string[]
  subject: string
  snippet: string
  bodyText: string
  receivedAt: string
  unread: boolean
  fromMe: boolean
}

interface DraftPlan {
  threadId: string
  to: string[]
  subject: string
  bodyText: string
  originalId: string
}

export function PendingScreen({ onChange }: { onChange: () => void }): JSX.Element {
  const [items, setItems] = useState<EmailMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = useState<DraftPlan | null>(null)

  const load = async (): Promise<void> => {
    const r = (await api.email.list()) as { ok: boolean; items?: EmailMessage[]; error?: string }
    if (!r.ok) {
      setError(r.error ?? 'unknown')
      setItems([])
    } else {
      setError(null)
      setItems(r.items ?? [])
    }
  }
  useEffect(() => { void load() }, [])

  const draft = async (m: EmailMessage): Promise<void> => {
    const r = (await api.email.draftReply(
      m.externalId,
      `Hi ${m.from.split('@')[0]},\n\nThanks for your note — I'll get back to you shortly.\n\nBest,`,
    )) as { ok: boolean; draft?: Omit<DraftPlan, 'originalId'>; error?: string }
    if (!r.ok || !r.draft) {
      alert(r.error ?? 'Could not draft')
      return
    }
    setPendingDraft({ ...r.draft, originalId: m.externalId })
  }

  const confirmSend = async (): Promise<void> => {
    if (!pendingDraft) return
    const { originalId, ...draft } = pendingDraft
    void originalId
    const r = (await api.email.send(draft, true)) as { ok: boolean; error?: string }
    setPendingDraft(null)
    if (!r.ok) alert(r.error ?? 'Send failed')
    onChange()
  }

  return (
    <div>
      <h2>Pending replies</h2>
      <p className="muted">
        Threads that look like they need your attention. Drafts are generated
        locally; sending requires the <code>email.send</code> permission AND an
        explicit confirmation in the modal below.
      </p>
      {error && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          Can't list email: <strong>{error}</strong>. Open Permissions and grant <code>email.read</code>.
        </div>
      )}
      {items.map((m) => (
        <div key={m.externalId} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{m.subject}</strong>
              <div className="muted">From {m.from} · {new Date(m.receivedAt).toLocaleString()}</div>
            </div>
            <button className="primary" onClick={() => draft(m)}>Draft reply</button>
          </div>
          <p style={{ marginTop: 8 }}>{m.snippet}</p>
        </div>
      ))}
      {pendingDraft && (
        <ConfirmationModal
          title="Send this email?"
          description={`To: ${pendingDraft.to.join(', ')}\nSubject: ${pendingDraft.subject}`}
          dataPreview={pendingDraft.bodyText}
          risk="high"
          approveLabel="Send"
          onApprove={confirmSend}
          onCancel={() => setPendingDraft(null)}
        />
      )}
    </div>
  )
}

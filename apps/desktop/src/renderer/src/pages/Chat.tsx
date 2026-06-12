import { useState } from 'react'
import { api } from '../api.js'
import { ConfirmationModal } from '../components/ConfirmationModal.js'

interface Message {
  role: 'user' | 'assistant'
  content: string
  blocked?: string[]
}

interface PendingPlan {
  toolName: string
  input: unknown
  description: string
  dataPreview?: string
  risk: 'low' | 'medium' | 'high'
  requiredPermissions: string[]
}

export function ChatScreen({ onChange }: { onChange: () => void }): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [plan, setPlan] = useState<PendingPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setBusy(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const r = (await api.agent.turn({ text, history })) as {
        ok: boolean
        reply?: string
        pendingPlan?: PendingPlan
        permissionBlocked?: string[]
        providerError?: { code: string; message: string }
      }
      if (!r.ok || r.providerError) {
        const err = r.providerError
        const help =
          err?.code === 'not_approved'
            ? ' Open Settings → AI Provider and approve the data notice.'
            : err?.code === 'local_only_mode'
              ? ' Disable Local-only mode in Settings → AI Provider, or switch back to the Local mock.'
              : err?.code === 'missing_api_key'
                ? ' Set the API key environment variable, then restart the app.'
                : ''
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `Provider error (${err?.code ?? 'error'}): ${err?.message ?? 'Unknown'}.${help}`,
          },
        ])
        return
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: r.reply ?? '', ...(r.permissionBlocked && { blocked: r.permissionBlocked }) },
      ])
      if (r.pendingPlan) setPlan(r.pendingPlan)
    } finally {
      setBusy(false)
    }
  }

  const approvePlan = async (): Promise<void> => {
    if (!plan) return
    const current = plan
    setPlan(null)
    const r = (await api.agent.execute(current)) as { ok: boolean; error?: string }
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: r.ok
          ? `Done. (${current.toolName})`
          : `I couldn't run ${current.toolName}: ${r.error}`,
      },
    ])
    onChange()
  }

  return (
    <div className="chat">
      <h2>Chat</h2>
      <div className="messages">
        {messages.length === 0 && (
          <p className="muted">
            Type a message below. The assistant runs locally and won't act on
            anything without explicit confirmation.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role}${m.blocked ? ' blocked' : ''}`}
          >
            {m.content}
            {m.blocked && (
              <div className="muted" style={{ marginTop: 6 }}>
                Blocked by missing permissions: {m.blocked.join(', ')}. Open the Permissions screen.
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="compose">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask anything…"
          disabled={busy}
        />
        <button className="primary" onClick={send} disabled={busy}>Send</button>
      </div>
      {plan && (
        <ConfirmationModal
          title={`Confirm: ${plan.toolName}`}
          description={plan.description}
          dataPreview={plan.dataPreview}
          risk={plan.risk}
          onApprove={approvePlan}
          onCancel={() => setPlan(null)}
        />
      )}
    </div>
  )
}

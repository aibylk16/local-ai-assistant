import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ConfirmationModal } from '../components/ConfirmationModal.js'

interface MemoryItem {
  id: number
  createdAt: string
  updatedAt: string
  kind: string
  title: string
  body: string
  tags: string[]
  reviewed: boolean
  encrypted: boolean
  source: string | null
}

export function MemoryScreen({ tick, onChange }: { tick: number; onChange: () => void }): JSX.Element {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [draft, setDraft] = useState({ title: '', body: '', kind: 'note' })

  const load = (): void => {
    void api.memory.list().then((r) => setItems(r as MemoryItem[]))
  }
  useEffect(load, [tick])

  const save = async (): Promise<void> => {
    if (!draft.title) return
    const r = (await api.memory.save({
      title: draft.title,
      body: draft.body,
      kind: draft.kind,
    })) as { ok: boolean; error?: string }
    if (!r.ok) alert(r.error ?? 'Could not save')
    setDraft({ title: '', body: '', kind: 'note' })
    onChange()
    load()
  }

  const remove = async (id: number): Promise<void> => {
    await api.memory.delete(id)
    load()
  }

  const wipe = async (): Promise<void> => {
    setConfirmWipe(false)
    await api.memory.deleteAll()
    load()
  }

  const exportAll = async (): Promise<void> => {
    const data = (await api.memory.export()) as MemoryItem[]
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2>Memory</h2>
      <p className="muted">
        Items here are stored locally. Encrypted-at-rest using your OS keychain
        (Windows DPAPI / macOS Keychain) when available. Saving requires the
        <code> memory.learning</code> permission.
      </p>
      <div className="card">
        <h3>New memory</h3>
        <div className="row">
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
            style={{ width: 180 }}
          >
            <option value="note">note</option>
            <option value="preference">preference</option>
            <option value="contact">contact</option>
            <option value="workflow">workflow</option>
            <option value="pending">pending</option>
          </select>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title"
          />
        </div>
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="Body — anything you want me to remember"
          style={{ marginTop: 8 }}
        />
        <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
          <button className="primary" onClick={save}>Save memory</button>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{items.length} items</strong>
        <div className="row">
          <button className="secondary" onClick={exportAll}>Export all</button>
          <button className="danger" onClick={() => setConfirmWipe(true)}>Delete all</button>
        </div>
      </div>
      {items.map((m) => (
        <div key={m.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className="tag low">{m.kind}</span>
              <strong>{m.title}</strong>
              {m.encrypted && <span className="muted" style={{ marginLeft: 8 }}>🔒 encrypted</span>}
            </div>
            <button className="secondary" onClick={() => remove(m.id)}>Delete</button>
          </div>
          <div className="muted" style={{ marginTop: 4 }}>{new Date(m.updatedAt).toLocaleString()}</div>
          {m.body && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{m.body}</pre>}
        </div>
      ))}
      {confirmWipe && (
        <ConfirmationModal
          title="Delete all memory?"
          description="This permanently deletes every memory item stored on this machine. You cannot undo this."
          risk="high"
          approveLabel="Delete everything"
          onApprove={wipe}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </div>
  )
}

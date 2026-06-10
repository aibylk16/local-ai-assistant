import { useEffect, useState } from 'react'
import { api } from '../api.js'

interface AuditEntry {
  id: number
  ts: string
  actor: string
  action: string
  risk: 'low' | 'medium' | 'high'
  result: 'ok' | 'denied' | 'error'
  detail: unknown
}

export function AuditScreen({ tick }: { tick: number }): JSX.Element {
  const [entries, setEntries] = useState<AuditEntry[]>([])

  useEffect(() => {
    void api.audit.recent(500).then((r) => setEntries(r as AuditEntry[]))
  }, [tick])

  return (
    <div>
      <h2>Activity / audit</h2>
      <p className="muted">
        Every action the assistant takes — permissions granted/revoked, tool runs,
        denied requests, background scans — lands here. This is the ground truth
        for "what did the assistant do".
      </p>
      {entries.map((e) => (
        <div key={e.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <span className={`tag ${e.risk}`}>{e.risk.toUpperCase()}</span>
              <span className="tag" style={{
                background: e.result === 'ok' ? '#1e3a2a' : e.result === 'denied' ? '#4a3a1e' : '#4a1e1e',
                color: e.result === 'ok' ? '#22c55e' : e.result === 'denied' ? '#f5a524' : '#ff8a8a',
              }}>{e.result.toUpperCase()}</span>
              <strong>{e.action}</strong>{' '}
              <span className="muted">by {e.actor}</span>
            </div>
            <span className="muted">{new Date(e.ts).toLocaleString()}</span>
          </div>
          {e.detail && (
            <pre style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              {JSON.stringify(e.detail, null, 2)}
            </pre>
          )}
        </div>
      ))}
      {entries.length === 0 && <p className="muted">No activity yet.</p>}
    </div>
  )
}

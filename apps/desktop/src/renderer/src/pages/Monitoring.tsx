import { useEffect, useState } from 'react'
import { api } from '../api.js'

interface Status {
  active: boolean
  lastRunAt: string | null
  lastError: string | null
  pendingCount: number
}

export function MonitoringScreen({ onChange }: { onChange: () => void }): JSX.Element {
  const [status, setStatus] = useState<Status | null>(null)

  const refresh = (): void => {
    void api.worker.status().then((s) => setStatus(s as Status))
  }
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [])

  const start = async (): Promise<void> => {
    const s = (await api.worker.start()) as Status
    setStatus(s)
    onChange()
  }
  const stop = async (): Promise<void> => {
    const s = (await api.worker.stop()) as Status
    setStatus(s)
    onChange()
  }

  return (
    <div>
      <h2>Background monitoring</h2>
      <p className="muted">
        Monitoring is opt-in. While it's on, the assistant scans connected sources
        on a timer to surface pending replies and follow-ups. The tray icon shows
        when monitoring is active. Every scan writes to the audit log.
      </p>
      {status && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>Status:</strong>{' '}
              <span className={`tag ${status.active ? 'low' : 'medium'}`}>
                {status.active ? 'ACTIVE' : 'PAUSED'}
              </span>
              <span style={{ marginLeft: 12 }}>Pending: {status.pendingCount}</span>
            </div>
            {status.active ? (
              <button className="secondary" onClick={stop}>Pause</button>
            ) : (
              <button className="primary" onClick={start}>Start</button>
            )}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Last run: {status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'never'}
          </div>
          {status.lastError && (
            <div style={{ color: 'var(--danger)', marginTop: 8 }}>
              Last error: {status.lastError}
            </div>
          )}
        </div>
      )}
      <p className="muted">
        Starting requires the <code>background.monitoring</code> permission.
        Revoking that permission immediately stops the worker.
      </p>
    </div>
  )
}

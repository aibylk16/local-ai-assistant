import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ConfirmationModal } from '../components/ConfirmationModal.js'

type ProviderId = 'mock' | 'openai' | 'anthropic'

interface ProviderInfo {
  id: ProviderId
  label: string
  local: boolean
  requiresApproval: boolean
  apiOrigin?: string
  apiKeyEnvVar?: string
  dataSentNotice: string
}

interface ProviderEntry {
  info: ProviderInfo
  hasApiKey: boolean
  cloudApproved: boolean
}

interface Settings {
  selectedProvider: ProviderId
  cloudApproved: Record<ProviderId, boolean>
  localOnlyMode: boolean
  memorySharing: boolean
}

type PendingApproval = { provider: ProviderEntry } | null

export function ProvidersScreen({ onChange }: { onChange: () => void }): JSX.Element {
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pendingApproval, setPendingApproval] = useState<PendingApproval>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    const [list, s] = await Promise.all([
      api.provider.list() as Promise<ProviderEntry[]>,
      api.provider.settings() as Promise<Settings>,
    ])
    setProviders(list)
    setSettings(s)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const selectProvider = async (entry: ProviderEntry): Promise<void> => {
    if (entry.info.requiresApproval && !entry.cloudApproved) {
      setPendingApproval({ provider: entry })
      return
    }
    setBusy(true)
    try {
      await api.provider.select(entry.info.id)
      await refresh()
      onChange()
    } finally {
      setBusy(false)
    }
  }

  const approveAndSelect = async (): Promise<void> => {
    if (!pendingApproval) return
    const entry = pendingApproval.provider
    setBusy(true)
    try {
      const r = (await api.provider.approveCloud(entry.info.id, true)) as { ok: boolean }
      if (r.ok) {
        await api.provider.select(entry.info.id)
        // Approving a cloud provider does NOT automatically disable local-only
        // mode — that is a separate, intentional step the user takes below.
      }
      await refresh()
      onChange()
    } finally {
      setBusy(false)
      setPendingApproval(null)
    }
  }

  const revoke = async (id: ProviderId): Promise<void> => {
    setBusy(true)
    try {
      await api.provider.revokeCloud(id)
      await refresh()
      onChange()
    } finally {
      setBusy(false)
    }
  }

  const toggleLocalOnly = async (): Promise<void> => {
    if (!settings) return
    setBusy(true)
    try {
      await api.provider.setLocalOnly(!settings.localOnlyMode)
      await refresh()
      onChange()
    } finally {
      setBusy(false)
    }
  }

  const toggleMemorySharing = async (): Promise<void> => {
    if (!settings) return
    setBusy(true)
    try {
      await api.provider.setMemorySharing(!settings.memorySharing)
      await refresh()
      onChange()
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <div>Loading…</div>

  return (
    <div>
      <h2>AI Provider</h2>
      <p className="muted">
        Choose which model powers the chat. The default is a fully offline mock — nothing leaves
        this machine. Cloud providers are disabled until you explicitly approve the data notice.
      </p>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Local-only mode</strong>
            <div className="muted">
              When ON, the assistant refuses every cloud call regardless of provider
              selection or approval. Acts as a master kill switch.
            </div>
          </div>
          <button
            className={settings.localOnlyMode ? 'primary' : 'secondary'}
            onClick={toggleLocalOnly}
            disabled={busy}
          >
            {settings.localOnlyMode ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <strong>Share memory items with the provider</strong>
            <div className="muted">
              Default is OFF. Memory items are never appended to the prompt unless this is on.
              Sensitive data (cards, OTPs, JWTs, secret keys) is blocked at write time regardless.
            </div>
          </div>
          <button
            className={settings.memorySharing ? 'danger' : 'secondary'}
            onClick={toggleMemorySharing}
            disabled={busy}
          >
            {settings.memorySharing ? 'Sharing' : 'Off'}
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Providers</h3>
      {providers.map((p) => {
        const selected = settings.selectedProvider === p.info.id
        const needsApproval = p.info.requiresApproval && !p.cloudApproved
        const keyMissing = !p.info.local && !p.hasApiKey
        return (
          <div key={p.info.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div>
                  <span className={`tag ${p.info.local ? 'low' : 'medium'}`}>
                    {p.info.local ? 'LOCAL' : 'CLOUD'}
                  </span>
                  <strong>{p.info.label}</strong>
                  {selected && <span className="tag low" style={{ marginLeft: 8 }}>ACTIVE</span>}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {p.info.dataSentNotice}
                </div>
                {p.info.apiKeyEnvVar && (
                  <div className="muted" style={{ marginTop: 6 }}>
                    API key env var: <code>{p.info.apiKeyEnvVar}</code> —{' '}
                    {p.hasApiKey ? 'detected ✔' : <span style={{ color: 'var(--warn)' }}>missing</span>}
                  </div>
                )}
                {p.info.apiOrigin && (
                  <div className="muted">Network origin: <code>{p.info.apiOrigin}</code></div>
                )}
                {needsApproval && (
                  <div className="muted" style={{ color: 'var(--warn)', marginTop: 6 }}>
                    Not yet approved — calls will be refused until you approve the data notice.
                  </div>
                )}
                {keyMissing && (
                  <div className="muted" style={{ color: 'var(--warn)', marginTop: 6 }}>
                    Missing API key — set the env var and restart the app.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className={selected ? 'secondary' : 'primary'}
                  onClick={() => selectProvider(p)}
                  disabled={busy || selected}
                >
                  {selected ? 'Selected' : 'Use this'}
                </button>
                {p.info.requiresApproval && p.cloudApproved && (
                  <button
                    className="secondary"
                    onClick={() => revoke(p.info.id)}
                    disabled={busy}
                  >
                    Revoke approval
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {pendingApproval && (
        <ConfirmationModal
          title={`Approve ${pendingApproval.provider.info.label}`}
          description={
            `This may send your message and recent chat context to ` +
            `${pendingApproval.provider.info.apiOrigin ?? pendingApproval.provider.info.label}. ` +
            pendingApproval.provider.info.dataSentNotice +
            (settings.localOnlyMode
              ? ' Note: Local-only mode is currently ON — even after approving, you will need to disable it before any cloud call can succeed.'
              : '')
          }
          risk="medium"
          onApprove={approveAndSelect}
          onCancel={() => setPendingApproval(null)}
        />
      )}
    </div>
  )
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type VoiceStyle = 'female' | 'male' | 'neutral'
type ProviderId = 'mock' | 'openai' | 'anthropic'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Identity {
  assistantName: string
  voiceStyle: VoiceStyle
  companyLabel: string
}

interface ProviderSettings {
  provider: ProviderId
  localOnly: boolean
  cloudApproved: Record<ProviderId, boolean>
}

const COMMON_NAMES = new Set([
  'alexa',
  'siri',
  'google',
  'cortana',
  'bixby',
  'echo',
  'computer',
  'assistant',
  'ai',
  'hey',
])

const DEFAULT_IDENTITY: Identity = {
  assistantName: '',
  voiceStyle: 'neutral',
  companyLabel: '',
}

const DEFAULT_PROVIDER: ProviderSettings = {
  provider: 'mock',
  localOnly: true,
  cloudApproved: {
    mock: true,
    openai: false,
    anthropic: false,
  },
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    return fallback
  }
}

function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function wakePhrase(name: string): string {
  const clean = name.trim()
  return clean ? `Hey ${clean}` : 'Not configured'
}

function nameWarning(name: string): string | null {
  const clean = name.trim()
  if (!clean) return 'Choose a unique assistant name before using voice wake mode.'
  if (clean.length > 40) return 'Use 40 characters or fewer.'
  if (COMMON_NAMES.has(clean.toLowerCase())) {
    return 'This name is common or used by another assistant. Pick a unique office-safe name.'
  }
  return null
}

function mockReply(input: string, identity: Identity): string {
  const name = identity.assistantName.trim() || 'your assistant'
  const lower = input.toLowerCase()
  if (lower.includes('excel') || lower.includes('sheet')) {
    return `${name} can help plan Excel and spreadsheet workflows. Real file access will run through the desktop companion with permission.`
  }
  if (lower.includes('whatsapp')) {
    return `${name} can track WhatsApp work through WhatsApp Business, manual import, or visible desktop companion flows. Personal full-chat reading is not officially available.`
  }
  if (lower.includes('email') || lower.includes('reply')) {
    return `${name} can help detect pending email replies once Gmail or Outlook connectors are enabled. Sending still requires confirmation.`
  }
  if (lower.includes('computer') || lower.includes('file')) {
    return `${name} will use the desktop companion for local computer and file tasks, because the web app cannot directly control your PC.`
  }
  return `${name} is ready in web mode. I can plan tasks online now, and deeper local actions will be handled by the desktop companion with permission.`
}

function App(): JSX.Element {
  const [identity, setIdentity] = React.useState<Identity>(() =>
    loadJson('assistant.identity', DEFAULT_IDENTITY),
  )
  const [provider, setProvider] = React.useState<ProviderSettings>(() =>
    loadJson('assistant.provider', DEFAULT_PROVIDER),
  )
  const [messages, setMessages] = React.useState<Message[]>([])
  const [draft, setDraft] = React.useState('')
  const [notice, setNotice] = React.useState<string | null>(null)

  React.useEffect(() => saveJson('assistant.identity', identity), [identity])
  React.useEffect(() => saveJson('assistant.provider', provider), [provider])

  const warning = nameWarning(identity.assistantName)
  const configured = identity.assistantName.trim().length > 0 && !warning?.startsWith('Choose')

  const send = (): void => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    let reply = mockReply(text, identity)

    if (provider.provider !== 'mock') {
      if (provider.localOnly) {
        reply = 'Local-only mode is on. Turn it off and approve the provider before any cloud call.'
      } else if (!provider.cloudApproved[provider.provider]) {
        reply = 'Cloud provider is not approved yet. Approve the data notice first.'
      } else {
        reply =
          'Cloud provider is selected, but this web preview does not store API keys yet. Use the desktop provider flow or add backend auth in the next phase.'
      }
    }

    setMessages([...nextMessages, { role: 'assistant', content: reply }])
  }

  const approveCloud = (id: ProviderId): void => {
    if (id === 'mock') return
    setProvider((p) => ({
      ...p,
      cloudApproved: { ...p.cloudApproved, [id]: true },
    }))
    setNotice(`Approved ${id}. Real cloud calls need backend/API-key work.`)
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Hybrid AI employee preview</p>
          <h1>{identity.assistantName.trim() || 'Name your assistant'}</h1>
        </div>
        <div className="status">
          <span>{provider.localOnly ? 'Local-only on' : 'Cloud allowed'}</span>
          <span>{provider.provider}</span>
        </div>
      </section>

      <section className="grid">
        <aside className="panel">
          <h2>Assistant Identity</h2>
          <label>
            Assistant name
            <input
              value={identity.assistantName}
              onChange={(e) => setIdentity((x) => ({ ...x, assistantName: e.target.value }))}
              placeholder="Tara, Nova, Riva"
            />
          </label>
          <label>
            Company/user label
            <input
              value={identity.companyLabel}
              onChange={(e) => setIdentity((x) => ({ ...x, companyLabel: e.target.value }))}
              placeholder="Acme office, Laxmi"
            />
          </label>
          <label>
            Voice style
            <select
              value={identity.voiceStyle}
              onChange={(e) =>
                setIdentity((x) => ({ ...x, voiceStyle: e.target.value as VoiceStyle }))
              }
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <div className="preview">
            Wake phrase: <strong>{wakePhrase(identity.assistantName)}</strong>
          </div>
          {warning && <div className="warning">{warning}</div>}
          {!warning && configured && (
            <div className="success">This name is ready for future wake mode.</div>
          )}
        </aside>

        <section className="panel chat">
          <h2>Web Chat</h2>
          <div className="messages">
            {messages.length === 0 ? (
              <p className="muted">
                This online preview uses a safe mock assistant. Web-only mode can plan work;
                desktop companion handles local computer actions.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  {m.content}
                </div>
              ))
            )}
          </div>
          <div className="compose">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
              }}
              placeholder="Ask about email, WhatsApp, Excel, files..."
            />
            <button onClick={send}>Send</button>
          </div>
        </section>

        <aside className="panel">
          <h2>Provider Safety</h2>
          <label>
            Provider
            <select
              value={provider.provider}
              onChange={(e) =>
                setProvider((p) => ({ ...p, provider: e.target.value as ProviderId }))
              }
            >
              <option value="mock">Local mock</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={provider.localOnly}
              onChange={(e) => setProvider((p) => ({ ...p, localOnly: e.target.checked }))}
            />
            Local-only kill switch
          </label>
          <button
            disabled={provider.provider === 'mock'}
            onClick={() => approveCloud(provider.provider)}
          >
            Approve selected cloud provider
          </button>
          <p className="muted">
            Cloud providers require explicit approval. Memory is not sent by default.
          </p>
          {notice && <div className="success">{notice}</div>}
        </aside>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

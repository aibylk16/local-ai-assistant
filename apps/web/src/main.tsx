import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type VoiceStyle = 'female' | 'male' | 'neutral'
type ProviderId = 'mock' | 'openai' | 'anthropic'

const PRODUCT_NAME = 'AI Employee'

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

interface WebAction {
  id: string
  label: string
  url: string
  reason: string
}

const WEB_ACTIONS: WebAction[] = [
  {
    id: 'youtube',
    label: 'Open YouTube',
    url: 'https://www.youtube.com/',
    reason: 'You asked to open YouTube in the browser.',
  },
  {
    id: 'google',
    label: 'Open Google',
    url: 'https://www.google.com/',
    reason: 'You asked to open Google in the browser.',
  },
  {
    id: 'gmail',
    label: 'Open Gmail',
    url: 'https://mail.google.com/',
    reason: 'You asked to open Gmail in the browser.',
  },
  {
    id: 'gmail-unread',
    label: 'Open Gmail unread search',
    url: 'https://mail.google.com/mail/u/0/#search/is%3Aunread',
    reason:
      'I can open Gmail filtered to unread messages. This web preview cannot read or count your inbox yet; Gmail access or the desktop companion is needed for that.',
  },
  {
    id: 'outlook',
    label: 'Open Outlook',
    url: 'https://outlook.live.com/mail/',
    reason: 'You asked to open Outlook in the browser.',
  },
]

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

function webAction(id: string): WebAction | null {
  return WEB_ACTIONS.find((action) => action.id === id) ?? null
}

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

const WORK_STATUS = [
  { label: 'Online app', value: 'Live' },
  { label: 'Training brain', value: 'Core ready' },
  { label: 'Desktop work', value: 'Companion required' },
  { label: 'Gmail/WhatsApp', value: 'Connector pending' },
] as const

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
    return `${name} can help plan Excel and spreadsheet work. Real file access will run through the desktop companion with permission.`
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
  return `${name} is ready in web mode. I can plan office work online now, and deeper local actions will be handled by the desktop companion with permission.`
}

function isMailAction(action: WebAction | null): boolean {
  return action?.id === 'gmail' || action?.id === 'gmail-unread' || action?.id === 'outlook'
}

function isCheckingFollowUp(input: string): boolean {
  const lower = input.toLowerCase()
  const asksCheck = /\b(check|checked|count|see|read|open|done|tell)\b/.test(lower)
  const asksStatus = /\b(are|did|have|has|can|u|you|it|now|many|pending|unread)\b/.test(lower)
  return asksCheck && asksStatus
}

function contextualReply(input: string, identity: Identity, lastOpenedAction: WebAction | null): string | null {
  if (!isMailAction(lastOpenedAction) || !isCheckingFollowUp(input)) return null

  const name = identity.assistantName.trim() || 'AI Employee'
  if (lastOpenedAction?.id === 'gmail-unread') {
    return `${name} opened Gmail's unread search in a new tab, but this online preview still cannot read or count your inbox. To answer "how many unread mails" for real, the next build needs Gmail sign-in plus a Gmail connector/backend permission flow.`
  }

  return `${name} opened the mail app in a new tab, but this online preview cannot inspect the mailbox yet. Real email checking needs Gmail or Outlook sign-in with explicit permission.`
}

function detectWebAction(input: string): WebAction | null {
  const lower = input.toLowerCase()
  const mentionsMail = /\b(gmail|email|mail|inbox)\b/.test(lower)
  const asksUnread =
    /\b(unread|pending|need reply|needs reply|reply pending|how many|count|check)\b/.test(lower)
  if (mentionsMail && asksUnread) return webAction('gmail-unread')
  if (!/\b(open|launch|go to|start)\b/.test(lower)) return null
  if (lower.includes('youtube') || lower.includes('you tube')) return webAction('youtube')
  if (lower.includes('gmail') || lower.includes('mail.google')) return webAction('gmail')
  if (lower.includes('outlook') || lower.includes('hotmail')) return webAction('outlook')
  if (lower.includes('email') || lower.includes('mail')) return webAction('gmail')
  if (lower.includes('google')) return webAction('google')
  return null
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
  const [pendingAction, setPendingAction] = React.useState<WebAction | null>(null)
  const [lastOpenedAction, setLastOpenedAction] = React.useState<WebAction | null>(null)

  React.useEffect(() => saveJson('assistant.identity', identity), [identity])
  React.useEffect(() => saveJson('assistant.provider', provider), [provider])

  const warning = nameWarning(identity.assistantName)
  const configured = identity.assistantName.trim().length > 0 && !warning?.startsWith('Choose')
  const assistantLabel = identity.assistantName.trim() || 'Not configured'

  const send = (): void => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    const nextMessages: Message[] = [...messages, { role: 'user', content: text }]
    const followUpReply = contextualReply(text, identity, lastOpenedAction)
    if (followUpReply) {
      setMessages([...nextMessages, { role: 'assistant', content: followUpReply }])
      return
    }

    const action = detectWebAction(text)
    if (action) {
      setPendingAction(action)
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `${action.reason} Please approve before I open ${action.url}.`,
        },
      ])
      return
    }

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

  const approveWebAction = (): void => {
    if (!pendingAction) return
    const action = pendingAction
    window.open(action.url, '_blank', 'noopener,noreferrer')
    setLastOpenedAction(action)
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: isMailAction(action)
          ? `Approved. Opening ${action.url} in a new tab. I can open it, but I cannot read or count your mailbox until the Gmail/Outlook connector is added.`
          : `Approved. Opening ${action.url} in a new tab.`,
      },
    ])
    setPendingAction(null)
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
          <p className="eyebrow">{PRODUCT_NAME}</p>
          <h1>Online work console</h1>
          <p className="subhead">
            Assistant: <strong>{assistantLabel}</strong>
            {identity.companyLabel.trim() ? ` - ${identity.companyLabel.trim()}` : ''}
          </p>
        </div>
        <div className="status">
          <span>{provider.localOnly ? 'Local-only on' : 'Cloud allowed'}</span>
          <span>{provider.provider}</span>
        </div>
      </section>

      <section className="workspace-strip" aria-label="AI Employee status">
        {WORK_STATUS.map((item) => (
          <div className="status-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </section>

      <section className="grid">
        <aside className="panel">
          <h2>Identity & Voice</h2>
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
          <h2>{PRODUCT_NAME} Chat</h2>
          <div className="messages">
            {messages.length === 0 ? (
              <p className="muted">
                Online mode is ready for planning, approvals, and safe web actions. Local
                computer actions run through the desktop companion.
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
          {pendingAction && (
            <div className="action-card">
              <div>
                <strong>{pendingAction.label}</strong>
                <p>{pendingAction.reason}</p>
                <code>{pendingAction.url}</code>
              </div>
              <div className="action-buttons">
                <button onClick={approveWebAction}>Allow</button>
                <button className="secondary" onClick={() => setPendingAction(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="panel">
          <h2>Safety & Access</h2>
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

          <div className="access-list">
            <div>
              <span>Web links</span>
              <strong>Approval required</strong>
            </div>
            <div>
              <span>Local files</span>
              <strong>Desktop companion</strong>
            </div>
            <div>
              <span>Send/delete/pay</span>
              <strong>Final confirmation</strong>
            </div>
          </div>
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

import { useEffect, useState } from 'react'
import { api } from '../api.js'

interface WhatsAppAdapterInfo {
  id: string
  label: string
  ready: boolean
}

interface AdapterMap {
  business: WhatsAppAdapterInfo
  manual: WhatsAppAdapterInfo
  observation: WhatsAppAdapterInfo
}

export function ConnectorsScreen(): JSX.Element {
  const [whatsapp, setWhatsapp] = useState<AdapterMap | null>(null)

  useEffect(() => {
    void api.whatsapp.adapters().then((r) => setWhatsapp(r as AdapterMap))
  }, [])

  return (
    <div>
      <h2>Connectors</h2>

      <div className="card">
        <h3>Email</h3>
        <p className="muted">
          The MVP ships a <strong>Mock Inbox</strong> connector so the pending-reply
          detector can be demonstrated without any account. Gmail, Microsoft Graph,
          and IMAP adapters live in <code>packages/connectors/src/email/</code> as
          placeholder classes — each file documents how to finish it.
        </p>
        <ul>
          <li><strong>mock</strong> — ready ✔</li>
          <li><strong>gmail</strong> — not configured (see <code>email/gmail.ts</code>)</li>
          <li><strong>graph</strong> — not configured (see <code>email/graph.ts</code>)</li>
          <li><strong>imap</strong> — not configured (see <code>email/imap.ts</code>)</li>
        </ul>
      </div>

      <div className="card">
        <h3>WhatsApp</h3>
        <p className="muted">
          <strong>Reality check:</strong> personal WhatsApp does not provide a
          stable official public API for reading all chats. The MVP exposes
          three adapter slots so the platform reality is visible in the UI.
        </p>
        {whatsapp && (
          <ul>
            <li>
              <strong>{whatsapp.business.label}</strong> — {whatsapp.business.ready ? 'ready' : 'not configured'}
            </li>
            <li>
              <strong>{whatsapp.manual.label}</strong> — {whatsapp.manual.ready ? 'ready' : 'no file imported'}
            </li>
            <li>
              <strong>{whatsapp.observation.label}</strong> — disabled by default; requires <code>screen.observe</code> and <code>accessibility</code>
            </li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Browser automation</h3>
        <p className="muted">
          Playwright adapter is scaffolded. Enabling it requires the
          <code> browser.automation</code> permission. Form submissions and purchases
          require an additional in-app confirmation.
        </p>
      </div>

      <div className="card">
        <h3>Filesystem</h3>
        <p className="muted">
          Local filesystem connector is available, gated by{' '}
          <code>file.read</code> / <code>file.write</code>. Writes refuse to
          overwrite existing files without explicit user confirmation.
        </p>
      </div>
    </div>
  )
}

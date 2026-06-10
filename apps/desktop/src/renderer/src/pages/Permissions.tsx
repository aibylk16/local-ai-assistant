import { useEffect, useState } from 'react'
import { api } from '../api.js'

interface Permission {
  category: string
  granted: boolean
  grantedAt: string | null
  notes: string | null
}

const RISK: Record<string, 'low' | 'medium' | 'high'> = {
  microphone: 'low',
  speaker: 'low',
  'file.read': 'low',
  'file.write': 'medium',
  'browser.automation': 'medium',
  'email.read': 'low',
  'email.draft': 'low',
  'email.send': 'high',
  'whatsapp.read': 'low',
  'whatsapp.draft': 'low',
  'whatsapp.send': 'high',
  'screen.observe': 'high',
  accessibility: 'high',
  'background.monitoring': 'medium',
  'memory.learning': 'low',
}

export function PermissionsScreen({ onChange }: { onChange: () => void }): JSX.Element {
  const [perms, setPerms] = useState<Permission[]>([])

  const load = (): void => {
    void api.permissions.list().then(setPerms)
  }
  useEffect(load, [])

  const toggle = async (p: Permission): Promise<void> => {
    if (p.granted) {
      const r = (await api.permissions.revoke(p.category)) as Permission[]
      setPerms(r)
    } else {
      const r = (await api.permissions.grant(p.category)) as Permission[]
      setPerms(r)
    }
    onChange()
  }

  return (
    <div>
      <h2>Permissions</h2>
      <p className="muted">
        All powerful permissions are off by default. Granting a permission does NOT
        cause any action — the assistant still asks before sending, deleting,
        purchasing, or installing.
      </p>
      {perms.map((p) => (
        <div key={p.category} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div>
                <span className={`tag ${RISK[p.category] ?? 'low'}`}>
                  {(RISK[p.category] ?? 'low').toUpperCase()}
                </span>
                <strong>{p.category}</strong>
              </div>
              <div className="muted">
                {p.granted ? `Granted ${p.grantedAt ?? ''}` : 'Not granted'}
              </div>
            </div>
            <button
              className={p.granted ? 'secondary' : 'primary'}
              onClick={() => toggle(p)}
            >
              {p.granted ? 'Revoke' : 'Grant'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

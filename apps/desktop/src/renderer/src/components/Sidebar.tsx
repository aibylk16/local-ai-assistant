export type ScreenId =
  | 'chat'
  | 'voice'
  | 'permissions'
  | 'memory'
  | 'audit'
  | 'connectors'
  | 'providers'
  | 'monitoring'
  | 'pending'

interface Props {
  active: ScreenId
  onSelect: (s: ScreenId) => void
  status: { active: boolean; pendingCount: number }
}

const ITEMS: Array<{ id: ScreenId; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'voice', label: 'Voice' },
  { id: 'pending', label: 'Pending replies' },
  { id: 'memory', label: 'Memory' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'providers', label: 'AI Provider' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'audit', label: 'Activity / audit' },
]

export function Sidebar({ active, onSelect, status }: Props): JSX.Element {
  const statusClass = status.active ? 'statusbar active' : 'statusbar'
  return (
    <aside className="sidebar">
      <h1>AI Employee</h1>
      <nav className="nav">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            className={active === it.id ? 'active' : ''}
            onClick={() => onSelect(it.id)}
          >
            {it.label}
          </button>
        ))}
      </nav>
      <div className={statusClass}>
        <span className="dot" />
        {status.active
          ? `Monitoring on - ${status.pendingCount} pending`
          : 'Monitoring off'}
      </div>
    </aside>
  )
}

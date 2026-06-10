import { useEffect, useState } from 'react'
import { api } from './api.js'
import { Sidebar, type ScreenId } from './components/Sidebar.js'
import { ChatScreen } from './pages/Chat.js'
import { VoiceScreen } from './pages/Voice.js'
import { PermissionsScreen } from './pages/Permissions.js'
import { MemoryScreen } from './pages/Memory.js'
import { AuditScreen } from './pages/Audit.js'
import { ConnectorsScreen } from './pages/Connectors.js'
import { MonitoringScreen } from './pages/Monitoring.js'
import { PendingScreen } from './pages/Pending.js'

interface Bootstrap {
  localOnlyMode: boolean
  provider: { id: string; label: string; local: boolean; dataSentNotice: string }
  workerStatus: { active: boolean; pendingCount: number; lastRunAt: string | null; lastError: string | null }
}

export function App(): JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('chat')
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    void api.bootstrap().then(setBoot)
  }, [])

  // Lightweight global refresh signal — pages call it after side-effecting actions.
  const refresh = (): void => setTick((t) => t + 1)

  if (!boot) {
    return <div className="app"><div className="main">Loading…</div></div>
  }

  return (
    <div className="app">
      <Sidebar active={screen} onSelect={setScreen} status={boot.workerStatus} />
      <main className="main">
        {screen === 'chat' && <ChatScreen onChange={refresh} />}
        {screen === 'voice' && <VoiceScreen />}
        {screen === 'permissions' && <PermissionsScreen onChange={refresh} />}
        {screen === 'memory' && <MemoryScreen tick={tick} onChange={refresh} />}
        {screen === 'audit' && <AuditScreen tick={tick} />}
        {screen === 'connectors' && <ConnectorsScreen />}
        {screen === 'monitoring' && <MonitoringScreen onChange={refresh} />}
        {screen === 'pending' && <PendingScreen onChange={refresh} />}
      </main>
    </div>
  )
}

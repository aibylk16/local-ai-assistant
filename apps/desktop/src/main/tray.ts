import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import type { Services } from './services.js'

let tray: Tray | null = null

/**
 * Tray indicator. Two important properties:
 *   1. It is always visible while the app runs, so background monitoring
 *      is never invisible to the user.
 *   2. Its title/tooltip changes when monitoring is active vs. paused,
 *      so the user can tell at a glance what the assistant is doing.
 */
export function setupTray(services: Services, window: BrowserWindow): void {
  // Empty 1x1 image keeps Electron happy on platforms that need a non-null
  // image. Replace with a real icon in resources/ once you ship.
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('AI Employee - idle')

  const refreshMenu = () => {
    const status = services.worker.getStatus()
    const monitoringGranted = services.permissions.isGranted('background.monitoring')

    const menu = Menu.buildFromTemplate([
      { label: 'Open AI Employee', click: () => window.show() },
      { type: 'separator' },
      {
        label: status.active
          ? `Monitoring: ON (${status.pendingCount} pending)`
          : monitoringGranted
            ? 'Monitoring: paused'
            : 'Monitoring: permission not granted',
        enabled: false,
      },
      {
        label: status.active ? 'Pause monitoring' : 'Resume monitoring',
        enabled: monitoringGranted,
        click: () => {
          if (status.active) services.worker.stop()
          else services.worker.start()
          refreshMenu()
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
    tray!.setContextMenu(menu)
    tray!.setToolTip(
      status.active
        ? `AI Employee - monitoring (${status.pendingCount} pending)`
        : 'AI Employee - idle',
    )
  }

  refreshMenu()
  // Re-render menu when worker status changes.
  setInterval(refreshMenu, 5000)
}

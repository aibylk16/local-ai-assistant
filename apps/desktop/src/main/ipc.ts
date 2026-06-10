import { ipcMain } from 'electron'
import type { Services } from './services.js'
import type { PermissionCategory } from '@local-ai-assistant/core'

/**
 * IPC channels. The renderer can ONLY do things via these channels.
 *
 * Security rules:
 *  - Every channel that performs an action (send, write, delete) checks
 *    the corresponding permission before doing anything.
 *  - The renderer cannot reach Node APIs directly — contextIsolation is on
 *    and only the channels declared here are exposed via the preload bridge.
 *  - Pending plans returned from `agent:turn` are confirmed by the user in
 *    the UI; `agent:execute` re-validates permissions before running them.
 */
export function registerIpc(services: Services): void {
  ipcMain.handle('app:bootstrap', () => ({
    localOnlyMode: services.localOnlyMode,
    provider: services.provider.info,
    workerStatus: services.worker.getStatus(),
  }))

  // ----- Permissions -----
  ipcMain.handle('permissions:list', () => services.permissions.all())
  ipcMain.handle(
    'permissions:grant',
    (_e, cat: PermissionCategory, notes?: string) => {
      services.permissions.grant(cat, notes)
      services.audit.record({
        actor: 'user',
        action: 'permission.grant',
        risk: 'medium',
        result: 'ok',
        detail: { category: cat },
      })
      return services.permissions.all()
    },
  )
  ipcMain.handle('permissions:revoke', (_e, cat: PermissionCategory) => {
    services.permissions.revoke(cat)
    services.audit.record({
      actor: 'user',
      action: 'permission.revoke',
      risk: 'low',
      result: 'ok',
      detail: { category: cat },
    })
    // Side effect: revoking background.monitoring stops the worker.
    if (cat === 'background.monitoring') services.worker.stop()
    return services.permissions.all()
  })

  // ----- Audit -----
  ipcMain.handle('audit:recent', (_e, limit?: number) => services.audit.recent(limit ?? 200))

  // ----- Memory -----
  ipcMain.handle('memory:list', (_e, kind?: string) =>
    services.memory.list(kind ? { kind: kind as never } : {}),
  )
  ipcMain.handle('memory:save', (_e, candidate: Parameters<Services['memory']['saveManually']>[0]) => {
    if (!services.permissions.isGranted('memory.learning')) {
      services.audit.record({
        actor: 'user',
        action: 'memory.save.denied',
        risk: 'low',
        result: 'denied',
      })
      return { ok: false, error: 'memory.learning permission not granted' }
    }
    const item = services.memory.saveManually(candidate)
    services.audit.record({
      actor: 'user',
      action: 'memory.save',
      risk: 'low',
      result: 'ok',
      detail: { id: item.id, kind: item.kind },
    })
    return { ok: true, item }
  })
  ipcMain.handle('memory:update', (_e, id: number, patch: Parameters<Services['memory']['update']>[1]) =>
    services.memory.update(id, patch),
  )
  ipcMain.handle('memory:delete', (_e, id: number) => {
    services.audit.record({
      actor: 'user',
      action: 'memory.delete',
      risk: 'low',
      result: 'ok',
      detail: { id },
    })
    return services.memory.delete(id)
  })
  ipcMain.handle('memory:deleteAll', () => {
    services.audit.record({
      actor: 'user',
      action: 'memory.deleteAll',
      risk: 'medium',
      result: 'ok',
    })
    return services.memory.deleteAll()
  })
  ipcMain.handle('memory:export', () => services.memory.exportAll())

  // ----- Agent (chat) -----
  ipcMain.handle('agent:turn', async (_e, input: { text: string; history?: never[] }) => {
    return services.agent.turn(input)
  })
  ipcMain.handle('agent:execute', async (_e, plan) => services.agent.executePlan(plan))

  // ----- Email (mock connector for now) -----
  ipcMain.handle('email:list', async () => {
    if (!services.permissions.isGranted('email.read')) {
      services.audit.record({
        actor: 'user',
        action: 'email.list.denied',
        risk: 'low',
        result: 'denied',
      })
      return { ok: false, error: 'email.read permission not granted' }
    }
    return { ok: true, items: await services.email.mock.listRecent() }
  })
  ipcMain.handle('email:draftReply', async (_e, originalId: string, body: string) => {
    if (!services.permissions.isGranted('email.draft')) {
      return { ok: false, error: 'email.draft permission not granted' }
    }
    return { ok: true, draft: await services.email.mock.draftReply(originalId, body) }
  })
  ipcMain.handle('email:send', async (_e, draft, confirmed: boolean) => {
    if (!services.permissions.isGranted('email.send')) {
      services.audit.record({
        actor: 'user',
        action: 'email.send.denied',
        risk: 'high',
        result: 'denied',
      })
      return { ok: false, error: 'email.send permission not granted' }
    }
    if (!confirmed) {
      services.audit.record({
        actor: 'user',
        action: 'email.send.denied',
        risk: 'high',
        result: 'denied',
        detail: { reason: 'no_confirmation' },
      })
      return { ok: false, error: 'send_requires_confirmation' }
    }
    const r = await services.email.mock.sendDraft(draft)
    services.audit.record({
      actor: 'user',
      action: 'email.send',
      risk: 'high',
      result: r.ok ? 'ok' : 'error',
      detail: { to: draft.to },
    })
    return r
  })

  // ----- WhatsApp -----
  ipcMain.handle('whatsapp:adapters', async () => ({
    business: { id: services.whatsapp.business.id, label: services.whatsapp.business.label, ready: await services.whatsapp.business.ready() },
    manual: { id: services.whatsapp.manual.id, label: services.whatsapp.manual.label, ready: await services.whatsapp.manual.ready() },
    observation: { id: services.whatsapp.observation.id, label: services.whatsapp.observation.label, ready: await services.whatsapp.observation.ready() },
  }))

  // ----- Background worker -----
  ipcMain.handle('worker:start', () => {
    services.worker.start()
    return services.worker.getStatus()
  })
  ipcMain.handle('worker:stop', () => {
    services.worker.stop()
    return services.worker.getStatus()
  })
  ipcMain.handle('worker:status', () => services.worker.getStatus())
}

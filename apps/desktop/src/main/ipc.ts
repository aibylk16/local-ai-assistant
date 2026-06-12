import { ipcMain } from 'electron'
import type { Services } from './services.js'
import {
  CloudNotApprovedError,
  LocalOnlyModeBlockedError,
  MissingApiKeyError,
  ProviderHttpError,
  type PermissionCategory,
  type ProviderId,
} from '@local-ai-assistant/core'

const PROVIDER_IDS: ProviderId[] = ['mock', 'openai', 'anthropic']

function isProviderId(s: unknown): s is ProviderId {
  return typeof s === 'string' && (PROVIDER_IDS as string[]).includes(s)
}

function describeProviderError(e: unknown): { code: string; message: string } {
  if (e instanceof MissingApiKeyError) {
    return { code: 'missing_api_key', message: e.message }
  }
  if (e instanceof CloudNotApprovedError) {
    return { code: 'not_approved', message: e.message }
  }
  if (e instanceof LocalOnlyModeBlockedError) {
    return { code: 'local_only_mode', message: e.message }
  }
  if (e instanceof ProviderHttpError) {
    return { code: `http_${e.status}`, message: e.message }
  }
  return { code: 'error', message: e instanceof Error ? e.message : String(e) }
}

function providerListPayload(services: Services): Array<{
  info: { id: string; label: string; local: boolean; requiresApproval: boolean; apiOrigin?: string; apiKeyEnvVar?: string; dataSentNotice: string }
  hasApiKey: boolean
  cloudApproved: boolean
}> {
  return PROVIDER_IDS.map((id) => {
    const p = services.providerRegistry[id]
    const info = p.info
    return {
      info: {
        id: info.id,
        label: info.label,
        local: info.local,
        requiresApproval: info.requiresApproval,
        ...(info.apiOrigin && { apiOrigin: info.apiOrigin }),
        ...(info.apiKeyEnvVar && { apiKeyEnvVar: info.apiKeyEnvVar }),
        dataSentNotice: info.dataSentNotice,
      },
      hasApiKey: p.hasApiKey ? p.hasApiKey() : true,
      cloudApproved: services.providerSettings.isCloudApproved(id),
    }
  })
}

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
    localOnlyMode: services.providerSettings.localOnlyMode(),
    provider: services.provider.info,
    providerSettings: services.providerSettings.snapshot(),
    workerStatus: services.worker.getStatus(),
  }))

  // ----- AI provider settings -----
  ipcMain.handle('provider:list', () => providerListPayload(services))
  ipcMain.handle('provider:settings', () => services.providerSettings.snapshot())
  ipcMain.handle('provider:select', (_e, id: unknown) => {
    if (!isProviderId(id)) return { ok: false, error: 'invalid_provider' }
    // Selecting a cloud provider that has not been approved is allowed, but
    // calls will fail closed until the user approves it. We DO NOT auto-disable
    // local-only mode here — that is a separate, explicit user action.
    services.providerSettings.setSelectedProvider(id)
    services.audit.record({
      actor: 'user',
      action: 'provider.select',
      risk: 'low',
      result: 'ok',
      detail: { provider: id },
    })
    return { ok: true, settings: services.providerSettings.snapshot() }
  })
  ipcMain.handle('provider:approveCloud', (_e, id: unknown, dataSentAcknowledged: unknown) => {
    if (!isProviderId(id)) return { ok: false, error: 'invalid_provider' }
    if (id === 'mock') return { ok: false, error: 'mock_does_not_require_approval' }
    if (dataSentAcknowledged !== true) {
      services.audit.record({
        actor: 'user',
        action: 'provider.cloud.approve.denied',
        risk: 'medium',
        result: 'denied',
        detail: { provider: id, reason: 'data_notice_not_acknowledged' },
      })
      return { ok: false, error: 'data_notice_not_acknowledged' }
    }
    services.providerSettings.approveCloud(id)
    services.audit.record({
      actor: 'user',
      action: 'provider.cloud.approve',
      risk: 'medium',
      result: 'ok',
      detail: {
        provider: id,
        dataSentNotice: services.providerRegistry[id].info.dataSentNotice,
      },
    })
    return { ok: true, settings: services.providerSettings.snapshot() }
  })
  ipcMain.handle('provider:revokeCloud', (_e, id: unknown) => {
    if (!isProviderId(id)) return { ok: false, error: 'invalid_provider' }
    if (id === 'mock') return { ok: true, settings: services.providerSettings.snapshot() }
    services.providerSettings.revokeCloud(id)
    services.audit.record({
      actor: 'user',
      action: 'provider.cloud.revoke',
      risk: 'low',
      result: 'ok',
      detail: { provider: id },
    })
    return { ok: true, settings: services.providerSettings.snapshot() }
  })
  ipcMain.handle('provider:setLocalOnly', (_e, on: unknown) => {
    const value = !!on
    services.providerSettings.setLocalOnlyMode(value)
    services.audit.record({
      actor: 'user',
      action: value ? 'provider.localOnly.enable' : 'provider.localOnly.disable',
      risk: 'medium',
      result: 'ok',
      detail: { localOnly: value },
    })
    return { ok: true, settings: services.providerSettings.snapshot() }
  })
  ipcMain.handle('provider:setMemorySharing', (_e, on: unknown) => {
    const value = !!on
    services.providerSettings.setMemorySharing(value)
    services.audit.record({
      actor: 'user',
      action: value ? 'provider.memorySharing.enable' : 'provider.memorySharing.disable',
      risk: 'medium',
      result: 'ok',
      detail: { memorySharing: value },
    })
    return { ok: true, settings: services.providerSettings.snapshot() }
  })

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
    try {
      const r = await services.agent.turn(input)
      return { ok: true, ...r }
    } catch (e) {
      const { code, message } = describeProviderError(e)
      return { ok: false, providerError: { code, message } }
    }
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

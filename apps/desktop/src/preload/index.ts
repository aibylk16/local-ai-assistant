import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload bridge. Only the channels listed here can be invoked from the
 * renderer. contextIsolation is on; the renderer never sees `require` or
 * raw Node APIs.
 */
const api = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),

  permissions: {
    list: () => ipcRenderer.invoke('permissions:list'),
    grant: (cat: string, notes?: string) => ipcRenderer.invoke('permissions:grant', cat, notes),
    revoke: (cat: string) => ipcRenderer.invoke('permissions:revoke', cat),
  },

  audit: {
    recent: (limit?: number) => ipcRenderer.invoke('audit:recent', limit),
  },

  memory: {
    list: (kind?: string) => ipcRenderer.invoke('memory:list', kind),
    save: (c: unknown) => ipcRenderer.invoke('memory:save', c),
    update: (id: number, patch: unknown) => ipcRenderer.invoke('memory:update', id, patch),
    delete: (id: number) => ipcRenderer.invoke('memory:delete', id),
    deleteAll: () => ipcRenderer.invoke('memory:deleteAll'),
    export: () => ipcRenderer.invoke('memory:export'),
  },

  agent: {
    turn: (input: { text: string; history?: unknown[] }) => ipcRenderer.invoke('agent:turn', input),
    execute: (plan: unknown) => ipcRenderer.invoke('agent:execute', plan),
  },

  email: {
    list: () => ipcRenderer.invoke('email:list'),
    draftReply: (originalId: string, body: string) =>
      ipcRenderer.invoke('email:draftReply', originalId, body),
    send: (draft: unknown, confirmed: boolean) =>
      ipcRenderer.invoke('email:send', draft, confirmed),
  },

  whatsapp: {
    adapters: () => ipcRenderer.invoke('whatsapp:adapters'),
  },

  worker: {
    start: () => ipcRenderer.invoke('worker:start'),
    stop: () => ipcRenderer.invoke('worker:stop'),
    status: () => ipcRenderer.invoke('worker:status'),
  },
}

contextBridge.exposeInMainWorld('assistant', api)

export type AssistantApi = typeof api

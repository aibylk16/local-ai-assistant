/**
 * The preload script exposes `window.assistant`. We declare its shape here
 * rather than importing from the preload file directly so the renderer
 * bundle doesn't try to pull in Electron internals.
 */

export interface AssistantApi {
  bootstrap: () => Promise<unknown>
  permissions: {
    list: () => Promise<unknown>
    grant: (cat: string, notes?: string) => Promise<unknown>
    revoke: (cat: string) => Promise<unknown>
  }
  audit: {
    recent: (limit?: number) => Promise<unknown>
  }
  memory: {
    list: (kind?: string) => Promise<unknown>
    save: (c: unknown) => Promise<unknown>
    update: (id: number, patch: unknown) => Promise<unknown>
    delete: (id: number) => Promise<unknown>
    deleteAll: () => Promise<unknown>
    export: () => Promise<unknown>
  }
  agent: {
    turn: (input: { text: string; history?: unknown[] }) => Promise<unknown>
    execute: (plan: unknown) => Promise<unknown>
  }
  email: {
    list: () => Promise<unknown>
    draftReply: (originalId: string, body: string) => Promise<unknown>
    send: (draft: unknown, confirmed: boolean) => Promise<unknown>
  }
  whatsapp: {
    adapters: () => Promise<unknown>
  }
  worker: {
    start: () => Promise<unknown>
    stop: () => Promise<unknown>
    status: () => Promise<unknown>
  }
}

declare global {
  interface Window {
    assistant: AssistantApi
  }
}

export const api = window.assistant

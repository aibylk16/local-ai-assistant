import type { AuditLogService, MemoryService, PermissionEngine } from '@local-ai-assistant/core'
import type { EmailConnector } from '@local-ai-assistant/connectors'
import { PendingReplyDetector } from '@local-ai-assistant/connectors'

export interface BackgroundWorkerOptions {
  permissions: PermissionEngine
  memory: MemoryService
  audit: AuditLogService
  emailConnectors: EmailConnector[]
  intervalMs?: number
  /** Called every cycle. UI uses this to drive the tray badge. */
  onStatusChange?: (s: BackgroundStatus) => void
}

export interface BackgroundStatus {
  active: boolean
  lastRunAt: string | null
  lastError: string | null
  pendingCount: number
}

/**
 * Background worker. Always opt-in (`background.monitoring` permission), always
 * visible (status feeds the tray), always pausable (`stop()` halts cleanly),
 * always logged (every cycle writes an audit entry).
 */
export class BackgroundWorker {
  private timer: ReturnType<typeof setInterval> | null = null
  private status: BackgroundStatus = {
    active: false,
    lastRunAt: null,
    lastError: null,
    pendingCount: 0,
  }
  private detector = new PendingReplyDetector()

  constructor(private readonly opts: BackgroundWorkerOptions) {}

  getStatus(): BackgroundStatus {
    return { ...this.status }
  }

  start(): void {
    if (!this.opts.permissions.isGranted('background.monitoring')) {
      this.opts.audit.record({
        actor: 'background',
        action: 'worker.start.denied',
        risk: 'medium',
        result: 'denied',
        detail: { reason: 'background.monitoring not granted' },
      })
      return
    }
    if (this.timer) return
    this.status = { ...this.status, active: true }
    this.opts.onStatusChange?.(this.status)
    this.opts.audit.record({
      actor: 'background',
      action: 'worker.start',
      risk: 'medium',
      result: 'ok',
    })

    const interval = this.opts.intervalMs ?? 5 * 60 * 1000
    void this.tick() // run immediately
    this.timer = setInterval(() => void this.tick(), interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.status = { ...this.status, active: false }
    this.opts.onStatusChange?.(this.status)
    this.opts.audit.record({
      actor: 'background',
      action: 'worker.stop',
      risk: 'low',
      result: 'ok',
    })
  }

  private async tick(): Promise<void> {
    try {
      if (!this.opts.permissions.isGranted('background.monitoring')) {
        this.stop()
        return
      }
      let pendingCount = 0
      for (const conn of this.opts.emailConnectors) {
        if (!this.opts.permissions.isGranted('email.read')) continue
        if (!(await conn.ready())) continue
        const recent = await conn.listRecent(50)
        const pending = this.detector.detect(recent)
        pendingCount += pending.length
        this.opts.audit.record({
          actor: 'background',
          action: 'worker.scan.email',
          risk: 'low',
          result: 'ok',
          detail: { connector: conn.id, pending: pending.length },
        })
      }
      this.status = {
        active: true,
        lastRunAt: new Date().toISOString(),
        lastError: null,
        pendingCount,
      }
      this.opts.onStatusChange?.(this.status)
    } catch (e) {
      this.status = {
        ...this.status,
        lastError: e instanceof Error ? e.message : String(e),
        lastRunAt: new Date().toISOString(),
      }
      this.opts.audit.record({
        actor: 'background',
        action: 'worker.scan.error',
        risk: 'low',
        result: 'error',
        detail: { error: this.status.lastError },
      })
      this.opts.onStatusChange?.(this.status)
    }
  }
}

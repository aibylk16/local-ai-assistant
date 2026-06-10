import type { DB } from '../db/types.js'
import type { RiskLevel } from '../permissions/types.js'

export type AuditActor = 'user' | 'agent' | 'background'
export type AuditResult = 'ok' | 'denied' | 'error'

export interface AuditEntry {
  id: number
  ts: string
  actor: AuditActor
  action: string
  risk: RiskLevel
  detail: unknown
  result: AuditResult
}

export interface AuditEntryInput {
  actor: AuditActor
  action: string
  risk: RiskLevel
  result: AuditResult
  detail?: unknown
}

export class AuditLogService {
  constructor(private readonly db: DB) {}

  /**
   * Every meaningful action (permission change, tool execution, message draft,
   * confirmation prompt, denied request) must be logged here. The audit log is
   * the single source of truth for "what did the assistant do".
   */
  record(input: AuditEntryInput): AuditEntry {
    const ts = new Date().toISOString()
    const detail = input.detail === undefined ? null : JSON.stringify(input.detail)
    const result = this.db
      .prepare(
        `INSERT INTO audit_log (ts, actor, action, risk, detail, result)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(ts, input.actor, input.action, input.risk, detail, input.result)
    return {
      id: Number(result.lastInsertRowid),
      ts,
      actor: input.actor,
      action: input.action,
      risk: input.risk,
      detail: input.detail ?? null,
      result: input.result,
    }
  }

  recent(limit = 100): AuditEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, ts, actor, action, risk, detail, result
         FROM audit_log ORDER BY id DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      id: number
      ts: string
      actor: AuditActor
      action: string
      risk: RiskLevel
      detail: string | null
      result: AuditResult
    }>
    return rows.map((r) => ({
      ...r,
      detail: r.detail ? safeParse(r.detail) : null,
    }))
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

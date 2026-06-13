import type { AuditLogService } from '../audit/service.js'
import type { DB } from '../db/types.js'
import { sanitizeWorkflowText } from '../workflows/sanitizer.js'
import type { WorkflowScope } from '../workflows/types.js'
import { findLessonSensitiveIssues } from './sanitizer.js'
import type { LearnedLesson, LearnedLessonInput, LessonSaveResult } from './types.js'

/**
 * Channel C - learning from successful work. After a task completes the
 * assistant can record a small, reusable LESSON: a preferred output format, a
 * better step order, a confirmation preference, an app/site preference, or a
 * classification rule. Lessons are preferences and rules, never user content.
 *
 * Invariants (tests pin each one):
 * - A lesson that looks like it carries private data is REFUSED (not redacted),
 *   the same strict rule backend seeds get.
 * - 'team'/'global' lessons require explicit approval and are still sanitized
 *   and blocked unless they are clean; they never carry private context out of
 *   personal learning.
 *
 * HONESTY NOTE: lessons tune the brain layer's preferences, not an LLM. No model
 * weights change.
 */
export class LessonStore {
  constructor(
    private readonly db: DB,
    private readonly audit?: AuditLogService,
  ) {}

  record(input: LearnedLessonInput): LessonSaveResult {
    if (!input.summary?.trim()) {
      return { saved: null, reason: 'invalid_lesson' }
    }

    if (input.scope !== 'private' && input.approvedByUser !== true) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.lesson.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { kind: input.kind, scope: input.scope, reason: 'shared_scope_requires_approval' },
      })
      return { saved: null, reason: 'shared_scope_requires_approval' }
    }

    const sensitive = findLessonSensitiveIssues(input)
    if (sensitive.length > 0) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.lesson.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { kind: input.kind, scope: input.scope, reason: 'sensitive_blocked', issues: sensitive },
      })
      return { saved: null, reason: 'sensitive_blocked' }
    }

    const ts = new Date().toISOString()
    const summary = sanitizeWorkflowText(input.summary)
    const detail = input.detail ? sanitizeWorkflowText(input.detail) : null
    const tags = (input.tags ?? []).map(sanitizeWorkflowText).filter(Boolean)
    const sourceDetail = input.sourceDetail ? sanitizeWorkflowText(input.sourceDetail) : null

    const result = this.db
      .prepare(
        `INSERT INTO learned_lessons (created_at, kind, scope, summary, detail, tags, source_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(ts, input.kind, input.scope, summary, detail, JSON.stringify(tags), sourceDetail)

    const saved = this.get(Number(result.lastInsertRowid))!
    this.audit?.record({
      actor: 'user',
      action: 'training.lesson.record',
      risk: input.scope === 'private' ? 'low' : 'medium',
      result: 'ok',
      detail: { id: saved.id, kind: saved.kind, scope: saved.scope },
    })
    return { saved }
  }

  get(id: number): LearnedLesson | null {
    const row = this.db
      .prepare(
        `SELECT id, created_at AS createdAt, kind, scope, summary, detail, tags,
                source_detail AS sourceDetail
         FROM learned_lessons WHERE id = ?`,
      )
      .get(id) as RawLessonRow | undefined
    return row ? hydrate(row) : null
  }

  list(opts: { scope?: WorkflowScope; limit?: number } = {}): LearnedLesson[] {
    const limit = opts.limit ?? 100
    const rows = opts.scope
      ? (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, kind, scope, summary, detail, tags,
                    source_detail AS sourceDetail
             FROM learned_lessons WHERE scope = ? ORDER BY id DESC LIMIT ?`,
          )
          .all(opts.scope, limit) as RawLessonRow[])
      : (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, kind, scope, summary, detail, tags,
                    source_detail AS sourceDetail
             FROM learned_lessons ORDER BY id DESC LIMIT ?`,
          )
          .all(limit) as RawLessonRow[])
    return rows.map(hydrate)
  }

  delete(id: number): boolean {
    const lesson = this.get(id)
    if (!lesson) return false
    this.db.prepare(`DELETE FROM learned_lessons WHERE id = ?`).run(id)
    this.audit?.record({
      actor: 'user',
      action: 'training.lesson.delete',
      risk: 'low',
      result: 'ok',
      detail: { id, scope: lesson.scope },
    })
    return true
  }
}

interface RawLessonRow {
  id: number
  createdAt: string
  kind: LearnedLesson['kind']
  scope: WorkflowScope
  summary: string
  detail: string | null
  tags: string
  sourceDetail: string | null
}

function hydrate(row: RawLessonRow): LearnedLesson {
  return {
    id: row.id,
    createdAt: row.createdAt,
    kind: row.kind,
    scope: row.scope,
    summary: row.summary,
    detail: row.detail,
    tags: parseJson(row.tags, [] as string[]),
    sourceDetail: row.sourceDetail,
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

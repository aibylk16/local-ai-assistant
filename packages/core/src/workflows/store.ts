import type { AuditLogService } from '../audit/service.js'
import type { DB } from '../db/types.js'
import { sanitizeWorkflowStep, sanitizeWorkflowText, workflowLooksSensitive } from './sanitizer.js'
import type {
  WorkflowMatch,
  WorkflowSaveResult,
  WorkflowScope,
  WorkflowStep,
  WorkflowTemplate,
  WorkflowTemplateInput,
} from './types.js'

export class WorkflowTemplateStore {
  constructor(
    private readonly db: DB,
    private readonly audit?: AuditLogService,
  ) {}

  save(input: WorkflowTemplateInput): WorkflowSaveResult {
    if (workflowLooksSensitive(input)) {
      this.audit?.record({
        actor: 'agent',
        action: 'workflow.learning.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { reason: 'sensitive_blocked', scope: input.scope, name: input.name },
      })
      return { saved: null, reason: 'sensitive_blocked' }
    }

    if (input.scope !== 'private' && !input.approvedForReuse) {
      this.audit?.record({
        actor: 'agent',
        action: 'workflow.learning.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { reason: 'shared_scope_requires_approval', scope: input.scope, name: input.name },
      })
      return { saved: null, reason: 'shared_scope_requires_approval' }
    }

    const ts = new Date().toISOString()
    const sanitized = {
      name: sanitizeWorkflowText(input.name),
      description: sanitizeWorkflowText(input.description),
      triggerPhrases: input.triggerPhrases.map(sanitizeWorkflowText).filter(Boolean),
      steps: input.steps.map(sanitizeWorkflowStep),
      apps: (input.apps ?? inferApps(input.steps)).map(sanitizeWorkflowText).filter(Boolean),
      tags: (input.tags ?? []).map(sanitizeWorkflowText).filter(Boolean),
      sourceDetail: input.sourceDetail ? sanitizeWorkflowText(input.sourceDetail) : null,
    }

    const result = this.db
      .prepare(
        `INSERT INTO workflow_templates (
          created_at, updated_at, name, description, scope, trigger_phrases,
          steps, apps, tags, requires_approval, approved_for_reuse,
          source_user_id, source_detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ts,
        ts,
        sanitized.name,
        sanitized.description,
        input.scope,
        JSON.stringify(sanitized.triggerPhrases),
        JSON.stringify(sanitized.steps),
        JSON.stringify(sanitized.apps),
        JSON.stringify(sanitized.tags),
        input.requiresApproval ?? true ? 1 : 0,
        input.approvedForReuse ? 1 : 0,
        input.sourceUserId ?? null,
        sanitized.sourceDetail,
      )

    const saved = this.get(Number(result.lastInsertRowid))!
    this.audit?.record({
      actor: 'user',
      action: 'workflow.learning.save',
      risk: input.scope === 'private' ? 'low' : 'medium',
      result: 'ok',
      detail: { id: saved.id, scope: saved.scope, approvedForReuse: saved.approvedForReuse },
    })
    return { saved }
  }

  get(id: number): WorkflowTemplate | null {
    const row = this.db
      .prepare(
        `SELECT id, created_at AS createdAt, updated_at AS updatedAt, name, description,
                scope, trigger_phrases AS triggerPhrases, steps, apps, tags,
                requires_approval AS requiresApproval, approved_for_reuse AS approvedForReuse,
                source_user_id AS sourceUserId, source_detail AS sourceDetail
         FROM workflow_templates WHERE id = ?`,
      )
      .get(id) as RawWorkflowRow | undefined
    return row ? hydrate(row) : null
  }

  list(opts: { scope?: WorkflowScope; limit?: number } = {}): WorkflowTemplate[] {
    const limit = opts.limit ?? 100
    const rows = opts.scope
      ? (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, updated_at AS updatedAt, name, description,
                    scope, trigger_phrases AS triggerPhrases, steps, apps, tags,
                    requires_approval AS requiresApproval, approved_for_reuse AS approvedForReuse,
                    source_user_id AS sourceUserId, source_detail AS sourceDetail
             FROM workflow_templates WHERE scope = ? ORDER BY updated_at DESC LIMIT ?`,
          )
          .all(opts.scope, limit) as RawWorkflowRow[])
      : (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, updated_at AS updatedAt, name, description,
                    scope, trigger_phrases AS triggerPhrases, steps, apps, tags,
                    requires_approval AS requiresApproval, approved_for_reuse AS approvedForReuse,
                    source_user_id AS sourceUserId, source_detail AS sourceDetail
             FROM workflow_templates ORDER BY updated_at DESC LIMIT ?`,
          )
          .all(limit) as RawWorkflowRow[])
    return rows.map(hydrate)
  }

  match(goal: string, opts: { limit?: number; includePrivate?: boolean } = {}): WorkflowMatch[] {
    const normalizedGoal = normalize(goal)
    if (!normalizedGoal) return []
    return this.list({ limit: 500 })
      .filter((template) => opts.includePrivate || template.scope !== 'private')
      .map((template) => scoreTemplate(template, normalizedGoal))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit ?? 5)
  }
}

function scoreTemplate(template: WorkflowTemplate, normalizedGoal: string): WorkflowMatch {
  let bestScore = 0
  let matchedPhrase: string | null = null
  for (const phrase of template.triggerPhrases) {
    const score = overlapScore(normalize(phrase), normalizedGoal)
    if (score > bestScore) {
      bestScore = score
      matchedPhrase = phrase
    }
  }
  return { template, score: bestScore, matchedPhrase }
}

function overlapScore(a: string, b: string): number {
  const left = new Set(a.split(' ').filter(Boolean))
  const right = new Set(b.split(' ').filter(Boolean))
  if (left.size === 0 || right.size === 0) return 0
  let hits = 0
  for (const token of left) {
    if (right.has(token)) hits += 1
  }
  return hits / Math.max(left.size, right.size)
}

function inferApps(steps: Array<{ app?: string }>): string[] {
  return [...new Set(steps.map((s) => s.app).filter((app): app is string => Boolean(app)))]
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hydrate(row: RawWorkflowRow): WorkflowTemplate {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    name: row.name,
    description: row.description,
    scope: row.scope,
    triggerPhrases: parseJson(row.triggerPhrases, []),
    steps: parseJson<WorkflowStep[]>(row.steps, []),
    apps: parseJson(row.apps, []),
    tags: parseJson(row.tags, []),
    requiresApproval: row.requiresApproval === 1,
    approvedForReuse: row.approvedForReuse === 1,
    sourceUserId: row.sourceUserId,
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

interface RawWorkflowRow {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  description: string
  scope: WorkflowScope
  triggerPhrases: string
  steps: string
  apps: string
  tags: string
  requiresApproval: number
  approvedForReuse: number
  sourceUserId: string | null
  sourceDetail: string | null
}

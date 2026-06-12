import type { AuditLogService } from '../audit/service.js'
import type { DB } from '../db/types.js'
import {
  sanitizeWorkflowStep,
  sanitizeWorkflowText,
  stepRequiresFinalConfirmation,
} from '../workflows/sanitizer.js'
import type { WorkflowTemplateStore } from '../workflows/store.js'
import type { WorkflowStepInput } from '../workflows/types.js'
import type {
  LearnedCorrection,
  LearnedCorrectionInput,
  TeachingSession,
  TeachingSessionStatus,
  TeachingStep,
  TeachingStepInput,
  WorkflowDraft,
  WorkflowPromotionRequest,
  WorkflowPromotionResult,
} from './types.js'

export class TeachingSessionError extends Error {
  constructor(
    readonly code: 'session_not_found' | 'session_locked',
    message: string,
  ) {
    super(message)
    this.name = 'TeachingSessionError'
  }
}

/**
 * Records teach-and-reuse sessions: the user demonstrates/describes a task,
 * the store keeps the raw steps locally, and `createDraft()` produces a
 * sanitized {@link WorkflowDraft} that the user can review and promote into
 * the {@link WorkflowTemplateStore}.
 *
 * Invariants this store enforces (tests pin each one):
 * - Raw step context (`rawContext`) never leaves the teaching tables. Drafts
 *   and promoted templates are built only from sanitized structure.
 * - Promotion to 'team' or 'global' requires `approvedByUser: true`.
 * - Side-effect steps (send/post/delete/upload/submit/payment) always carry
 *   `requires_final_confirmation` - enforced again at draft time even if the
 *   recorded step claimed otherwise.
 * - Promoted templates still go through the workflow store's own sensitive-
 *   content block and approval gate; this store never bypasses them.
 *
 * This is workflow/preference learning, NOT model training. No LLM is
 * involved or required.
 */
export class TeachingSessionStore {
  constructor(
    private readonly db: DB,
    private readonly workflows: WorkflowTemplateStore,
    private readonly audit?: AuditLogService,
  ) {}

  startSession(goal: string): TeachingSession {
    const ts = new Date().toISOString()
    const result = this.db
      .prepare(
        `INSERT INTO teaching_sessions (created_at, updated_at, goal, status)
         VALUES (?, ?, ?, 'recording')`,
      )
      .run(ts, ts, goal.trim())
    const session = this.getSession(Number(result.lastInsertRowid))!
    this.audit?.record({
      actor: 'user',
      action: 'teaching.session.start',
      risk: 'low',
      result: 'ok',
      detail: { sessionId: session.id, goal: session.goal },
    })
    return session
  }

  addStep(sessionId: number, input: TeachingStepInput): TeachingStep {
    this.requireEditable(sessionId)
    const ts = new Date().toISOString()
    const position = this.stepCount(sessionId)
    const result = this.db
      .prepare(
        `INSERT INTO teaching_steps
           (session_id, created_at, position, kind, instruction, app, target, selector_hint, raw_context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        ts,
        position,
        input.kind,
        input.instruction,
        input.app ?? null,
        input.target ?? null,
        input.selectorHint ?? null,
        input.rawContext ?? null,
      )
    this.touch(sessionId)
    this.audit?.record({
      actor: 'user',
      action: 'teaching.step.add',
      risk: 'low',
      result: 'ok',
      detail: { sessionId, position, kind: input.kind },
    })
    return {
      id: Number(result.lastInsertRowid),
      sessionId,
      createdAt: ts,
      position,
      kind: input.kind,
      instruction: input.instruction,
      app: input.app,
      target: input.target,
      selectorHint: input.selectorHint,
      rawContext: input.rawContext,
    }
  }

  addCorrection(sessionId: number, input: LearnedCorrectionInput): LearnedCorrection {
    this.requireEditable(sessionId)
    const ts = new Date().toISOString()
    const stepPosition = input.stepPosition ?? null
    const result = this.db
      .prepare(
        `INSERT INTO teaching_corrections (session_id, created_at, step_position, instruction)
         VALUES (?, ?, ?, ?)`,
      )
      .run(sessionId, ts, stepPosition, input.instruction)
    this.touch(sessionId)
    this.audit?.record({
      actor: 'user',
      action: 'teaching.correction.add',
      risk: 'low',
      result: 'ok',
      detail: { sessionId, stepPosition },
    })
    return {
      id: Number(result.lastInsertRowid),
      sessionId,
      createdAt: ts,
      stepPosition,
      instruction: input.instruction,
    }
  }

  /**
   * Build (or rebuild) the sanitized draft from the recorded steps plus any
   * corrections. Raw context is deliberately dropped here - it never reaches
   * the draft. Re-running after a new correction replaces the stored draft.
   */
  createDraft(
    sessionId: number,
    opts: { name?: string; description?: string; triggerPhrases?: string[]; tags?: string[] } = {},
  ): WorkflowDraft {
    const session = this.requireEditable(sessionId)
    const rawSteps = this.getSteps(sessionId)
    const corrections = this.getCorrections(sessionId)
    const warnings: string[] = []

    const stepInputs: WorkflowStepInput[] = rawSteps.map((step) => {
      const correction = lastCorrectionFor(corrections, step.position)
      // NOTE: rawContext is intentionally not part of WorkflowStepInput - it
      // cannot be carried into the draft even by mistake.
      return {
        kind: step.kind,
        instruction: correction ? correction.instruction : step.instruction,
        app: step.app,
        target: step.target,
        selectorHint: step.selectorHint,
      }
    })

    const sessionCorrections = corrections.filter((c) => c.stepPosition === null)
    const description = [
      opts.description ?? `Taught workflow for: ${session.goal}`,
      ...sessionCorrections.map((c) => `Correction: ${c.instruction}`),
    ].join(' ')

    const steps = stepInputs.map((input, i) => {
      const sanitized = sanitizeWorkflowStep(input)
      if (sanitized.instruction !== input.instruction.trim()) {
        warnings.push(`Step ${i + 1}: private-looking data was redacted from the instruction.`)
      }
      if (
        stepRequiresFinalConfirmation(input) &&
        input.dataPolicy !== 'requires_final_confirmation'
      ) {
        warnings.push(
          `Step ${i + 1}: looks like a send/post/delete/upload/submit/payment action - ` +
            'it will always ask for final confirmation before running.',
        )
      }
      if (sanitized.instruction.split(' ').filter(Boolean).length < 3) {
        warnings.push(
          `Step ${i + 1}: the instruction is very short - consider clarifying it so the ` +
            'workflow can be replayed reliably.',
        )
      }
      return sanitized
    })

    const draft: WorkflowDraft = {
      sessionId,
      name: sanitizeWorkflowText(opts.name ?? session.goal),
      description: sanitizeWorkflowText(description),
      triggerPhrases: (opts.triggerPhrases ?? [session.goal])
        .map(sanitizeWorkflowText)
        .filter(Boolean),
      steps,
      apps: [...new Set(steps.map((s) => s.app).filter((a): a is string => Boolean(a)))],
      tags: (opts.tags ?? []).map(sanitizeWorkflowText).filter(Boolean),
      warnings,
    }

    this.db
      .prepare(`UPDATE teaching_sessions SET draft = ?, status = 'drafted', updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(draft), new Date().toISOString(), sessionId)
    this.audit?.record({
      actor: 'user',
      action: 'teaching.draft.create',
      risk: 'low',
      result: 'ok',
      detail: { sessionId, steps: draft.steps.length, warnings: draft.warnings.length },
    })
    return draft
  }

  getDraft(sessionId: number): WorkflowDraft | null {
    const row = this.db
      .prepare(`SELECT draft FROM teaching_sessions WHERE id = ?`)
      .get(sessionId) as { draft: string | null } | undefined
    if (!row?.draft) return null
    try {
      return JSON.parse(row.draft) as WorkflowDraft
    } catch {
      return null
    }
  }

  /**
   * Store the draft as a reusable workflow template. 'team' and 'global'
   * scopes require `approvedByUser: true`; the underlying workflow store
   * additionally applies its own sensitive-content block. On success the
   * session is marked 'promoted'.
   */
  approveDraft(request: WorkflowPromotionRequest): WorkflowPromotionResult {
    const session = this.getSession(request.sessionId)
    if (!session) return { promotedTemplateId: null, reason: 'session_not_found' }
    const draft = this.getDraft(request.sessionId)
    if (!draft || session.status !== 'drafted') {
      return { promotedTemplateId: null, reason: 'not_drafted' }
    }

    if (request.scope !== 'private' && !request.approvedByUser) {
      this.audit?.record({
        actor: 'agent',
        action: 'teaching.promotion.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { sessionId: request.sessionId, scope: request.scope, reason: 'approval_required' },
      })
      return { promotedTemplateId: null, reason: 'approval_required' }
    }

    const saved = this.workflows.save({
      name: draft.name,
      description: draft.description,
      scope: request.scope,
      triggerPhrases: draft.triggerPhrases,
      steps: draft.steps,
      apps: draft.apps,
      tags: draft.tags,
      requiresApproval: true,
      approvedForReuse: request.scope === 'private' ? request.approvedByUser : true,
      sourceUserId: request.sourceUserId ?? null,
      sourceDetail: `teaching session ${request.sessionId}`,
    })
    if (!saved.saved) {
      return { promotedTemplateId: null, reason: saved.reason }
    }

    this.db
      .prepare(`UPDATE teaching_sessions SET status = 'promoted', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), request.sessionId)
    this.audit?.record({
      actor: 'user',
      action: 'teaching.draft.promote',
      risk: request.scope === 'private' ? 'low' : 'medium',
      result: 'ok',
      detail: {
        sessionId: request.sessionId,
        templateId: saved.saved.id,
        scope: request.scope,
        approvedByUser: request.approvedByUser,
      },
    })
    return { promotedTemplateId: saved.saved.id }
  }

  getSession(id: number): TeachingSession | null {
    const row = this.db
      .prepare(
        `SELECT id, created_at AS createdAt, updated_at AS updatedAt, goal, status
         FROM teaching_sessions WHERE id = ?`,
      )
      .get(id) as TeachingSession | undefined
    return row ?? null
  }

  listSessions(opts: { status?: TeachingSessionStatus; limit?: number } = {}): TeachingSession[] {
    const limit = opts.limit ?? 100
    if (opts.status) {
      return this.db
        .prepare(
          `SELECT id, created_at AS createdAt, updated_at AS updatedAt, goal, status
           FROM teaching_sessions WHERE status = ? ORDER BY updated_at DESC LIMIT ?`,
        )
        .all(opts.status, limit) as TeachingSession[]
    }
    return this.db
      .prepare(
        `SELECT id, created_at AS createdAt, updated_at AS updatedAt, goal, status
         FROM teaching_sessions ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(limit) as TeachingSession[]
  }

  getSteps(sessionId: number): TeachingStep[] {
    const rows = this.db
      .prepare(
        `SELECT id, session_id AS sessionId, created_at AS createdAt, position, kind,
                instruction, app, target, selector_hint AS selectorHint, raw_context AS rawContext
         FROM teaching_steps WHERE session_id = ? ORDER BY position ASC`,
      )
      .all(sessionId) as Array<TeachingStep & { app: string | null; target: string | null; selectorHint: string | null; rawContext: string | null }>
    return rows.map((r) => ({
      ...r,
      app: r.app ?? undefined,
      target: r.target ?? undefined,
      selectorHint: r.selectorHint ?? undefined,
      rawContext: r.rawContext ?? undefined,
    }))
  }

  getCorrections(sessionId: number): LearnedCorrection[] {
    return this.db
      .prepare(
        `SELECT id, session_id AS sessionId, created_at AS createdAt,
                step_position AS stepPosition, instruction
         FROM teaching_corrections WHERE session_id = ? ORDER BY id ASC`,
      )
      .all(sessionId) as LearnedCorrection[]
  }

  /** Hard-delete a session with its steps and corrections (user control). */
  deleteSession(id: number): boolean {
    const session = this.getSession(id)
    if (!session) return false
    this.db.prepare(`DELETE FROM teaching_sessions WHERE id = ?`).run(id)
    this.audit?.record({
      actor: 'user',
      action: 'teaching.session.delete',
      risk: 'low',
      result: 'ok',
      detail: { sessionId: id, status: session.status },
    })
    return true
  }

  private requireEditable(sessionId: number): TeachingSession {
    const session = this.getSession(sessionId)
    if (!session) {
      throw new TeachingSessionError('session_not_found', `Teaching session ${sessionId} not found.`)
    }
    if (session.status === 'promoted' || session.status === 'discarded') {
      throw new TeachingSessionError(
        'session_locked',
        `Teaching session ${sessionId} is ${session.status} and can no longer be edited.`,
      )
    }
    return session
  }

  private stepCount(sessionId: number): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM teaching_steps WHERE session_id = ?`)
      .get(sessionId) as { n: number }
    return row.n
  }

  private touch(sessionId: number): void {
    // Adding steps/corrections to a drafted session reopens recording so the
    // stale draft cannot be promoted without a rebuild via createDraft().
    this.db
      .prepare(`UPDATE teaching_sessions SET updated_at = ?, status = 'recording' WHERE id = ?`)
      .run(new Date().toISOString(), sessionId)
  }
}

function lastCorrectionFor(
  corrections: LearnedCorrection[],
  position: number,
): LearnedCorrection | undefined {
  for (let i = corrections.length - 1; i >= 0; i -= 1) {
    if (corrections[i]!.stepPosition === position) return corrections[i]
  }
  return undefined
}

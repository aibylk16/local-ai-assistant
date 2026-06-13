import type { AuditLogService } from '../audit/service.js'
import { stepRequiresFinalConfirmation } from '../workflows/sanitizer.js'
import type { WorkflowTemplateStore } from '../workflows/store.js'
import type { WorkflowStepInput } from '../workflows/types.js'
import { findSeedSensitiveIssues, seedStructureIssues } from './sanitizer.js'
import type { SeedImportResult, SeedImportSummary, TaskSeed } from './types.js'

/**
 * Backend/admin training (channel B). Imports generic {@link TaskSeed}s into the
 * existing {@link WorkflowTemplateStore} so a fresh install can ship with useful
 * office skills.
 *
 * Invariants (tests pin each one):
 * - A seed that looks like it carries private data is REFUSED, not redacted.
 * - 'team'/'global' seeds require `approvedByUser: true` (or an override passed
 *   at import time); refusals are audited.
 * - Backend training NEVER bypasses the workflow store's own sensitive-content
 *   block, scope-approval gate, or the sanitizer's forced final-confirmation on
 *   side-effect steps. The brain can be pre-trained, but the safety rails are
 *   exactly the same as user teaching.
 *
 * HONESTY NOTE: this stores task STRUCTURE, not model weights. No LLM is trained.
 */
export class BackendTrainingImporter {
  constructor(
    private readonly workflows: WorkflowTemplateStore,
    private readonly audit?: AuditLogService,
  ) {}

  /**
   * Import one seed. `opts.approve` can grant team/global approval at import
   * time without mutating the seed file (useful for an admin screen), but it can
   * never relax the sensitive-content or scope checks below it.
   */
  import(seed: TaskSeed, opts: { approve?: boolean } = {}): SeedImportResult {
    const warnings: string[] = []

    const structure = seedStructureIssues(seed)
    if (structure.length > 0) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.seed.blocked',
        risk: 'low',
        result: 'denied',
        detail: { goal: seed.goal, reason: 'invalid_seed', issues: structure },
      })
      return { goal: seed.goal, importedTemplateId: null, reason: 'invalid_seed', warnings: structure }
    }

    const sensitive = findSeedSensitiveIssues(seed)
    if (sensitive.length > 0) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.seed.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { goal: seed.goal, reason: 'sensitive_blocked', issues: sensitive },
      })
      return {
        goal: seed.goal,
        importedTemplateId: null,
        reason: 'sensitive_blocked',
        warnings: sensitive.map((i) => `${i.field}: ${i.reason}`),
      }
    }

    const approved = seed.approvedByUser || opts.approve === true
    if (seed.scope !== 'private' && !approved) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.seed.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { goal: seed.goal, reason: 'approval_required', scope: seed.scope },
      })
      return { goal: seed.goal, importedTemplateId: null, reason: 'approval_required', warnings }
    }

    const steps: WorkflowStepInput[] = seed.steps.map((s) => ({
      kind: s.kind,
      instruction: s.instruction,
      app: s.app,
      target: s.target,
      selectorHint: s.selectorHint,
    }))

    // Advisory mismatch: a side-effect step exists but the seed claimed no final
    // confirmation. The sanitizer will still force it; surface it as a warning so
    // the developer fixes the seed metadata.
    const hasSideEffect = steps.some(stepRequiresFinalConfirmation)
    if (hasSideEffect && !seed.finalConfirmation) {
      warnings.push(
        'A step looks like send/post/delete/upload/submit/payment; final confirmation will be ' +
          'required at run time even though the seed set finalConfirmation: false.',
      )
    }

    const saved = this.workflows.save({
      name: seed.goal,
      description: `Seeded office skill: ${seed.goal}`,
      scope: seed.scope,
      triggerPhrases: seed.triggerPhrases,
      steps,
      apps: seed.apps,
      tags: seed.tags,
      requiresApproval: true,
      // private seeds still require explicit approval to be reusable; shared
      // seeds are already gated above.
      approvedForReuse: seed.scope === 'private' ? approved : true,
      sourceUserId: null,
      sourceDetail: 'backend training seed',
    })

    if (!saved.saved) {
      this.audit?.record({
        actor: 'agent',
        action: 'training.seed.blocked',
        risk: 'medium',
        result: 'denied',
        detail: { goal: seed.goal, reason: saved.reason, scope: seed.scope },
      })
      return { goal: seed.goal, importedTemplateId: null, reason: saved.reason, warnings }
    }

    this.audit?.record({
      actor: 'user',
      action: 'training.seed.import',
      risk: seed.scope === 'private' ? 'low' : 'medium',
      result: 'ok',
      detail: {
        goal: seed.goal,
        templateId: saved.saved.id,
        scope: seed.scope,
        approved,
        forcedFinalConfirmation: hasSideEffect,
      },
    })
    return { goal: seed.goal, importedTemplateId: saved.saved.id, warnings }
  }

  /** Import a batch, returning a per-seed breakdown plus totals. */
  importAll(seeds: TaskSeed[], opts: { approve?: boolean } = {}): SeedImportSummary {
    const results = seeds.map((seed) => this.import(seed, opts))
    return {
      imported: results.filter((r) => r.importedTemplateId !== null).length,
      refused: results.filter((r) => r.importedTemplateId === null).length,
      results,
    }
  }
}

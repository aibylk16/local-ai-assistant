import type { PermissionCategory } from '../permissions/types.js'
import type { WorkflowScope, WorkflowStepKind } from '../workflows/types.js'

/**
 * Trainable AI Employee Brain - the layer that lets the assistant be taught
 * office skills and reuse them silently later.
 *
 * HONESTY NOTE: this is NOT training or fine-tuning an LLM. No model weights are
 * updated in this pass. "Training" here means recording, sanitizing, and reusing
 * task STRUCTURE and PREFERENCES through the existing workflow store. The four
 * channels below feed that brain layer; channel D only *prepares* sanitized data
 * that a future, opt-in fine-tuning step could use - it does not train anything.
 *
 * The four training channels:
 *   A. User teaching          -> packages/core/src/teaching (already exists)
 *   B. Backend/admin training -> {@link TaskSeed} + {@link "./importer"}
 *   C. Learning from work      -> {@link LearnedLesson} + {@link "./lessons"}
 *   D. Future fine-tuning data -> {@link FineTuningRecord} + {@link "./fine-tuning"}
 */

/**
 * A generic, GENERIC-ONLY office-task definition a developer/admin can seed from
 * a backend file or script. Seeds must never contain a real user's private data
 * (message bodies, contacts, IDs, prices, files, credentials). They describe how
 * a task is done, not what data flowed through it.
 */
export interface TaskSeed {
  /** Generic task name, e.g. "check unread emails that need reply". */
  goal: string
  /** How a user might naturally ask for this task. */
  triggerPhrases: string[]
  /** App/site names involved, e.g. ["gmail", "excel"]. */
  apps: string[]
  /** Ordered generic steps. No private data. */
  steps: SeedStep[]
  /** Permissions the task will request before it can run. */
  requiredPermissions: PermissionCategory[]
  /**
   * Whether the task ends in a side effect (send/post/delete/upload/submit/pay)
   * that must ask for final confirmation. This is advisory: the sanitizer still
   * forces final confirmation on any step that looks like a side effect, even if
   * this is false.
   */
  finalConfirmation: boolean
  /** Where the learned skill can be reused. */
  scope: WorkflowScope
  /**
   * Must be true to import a 'team' or 'global' seed. Recording it on the seed
   * keeps the developer's approval explicit and auditable.
   */
  approvedByUser: boolean
  tags: string[]
}

export interface SeedStep {
  kind: WorkflowStepKind
  /** Generic instruction, e.g. "Open the unread message list." */
  instruction: string
  app?: string
  target?: string
  selectorHint?: string
}

/** A reason a single seed was refused at import time. */
export type SeedRefusalReason =
  | 'invalid_seed'
  | 'sensitive_blocked'
  | 'approval_required'
  | 'shared_scope_requires_approval'

/** The outcome of importing one seed. */
export interface SeedImportResult {
  goal: string
  /** The stored template id, or null when the seed was refused. */
  importedTemplateId: number | null
  reason?: SeedRefusalReason
  /** Non-fatal notes the developer should see (e.g. a forced confirmation). */
  warnings: string[]
}

/** The outcome of importing a batch of seeds. */
export interface SeedImportSummary {
  imported: number
  refused: number
  results: SeedImportResult[]
}

/** One field/reason pair explaining why a seed looked unsafe to store. */
export interface SeedSensitiveIssue {
  field: string
  reason: string
}

/**
 * Channel C - a small, reusable lesson the assistant inferred or was told after
 * a task completed. Lessons are PREFERENCES and RULES, never user content.
 */
export type LearnedLessonKind =
  | 'output_format'
  | 'step_order'
  | 'confirmation_preference'
  | 'app_preference'
  | 'classification_rule'

export interface LearnedLessonInput {
  kind: LearnedLessonKind
  /** Short generic statement, e.g. "Group monthly reports by week, totals on top." */
  summary: string
  /** Optional longer generic detail. */
  detail?: string
  scope: WorkflowScope
  /** Must be true before storing a team/global lesson. */
  approvedByUser?: boolean
  tags?: string[]
  sourceDetail?: string
}

export interface LearnedLesson {
  id: number
  createdAt: string
  kind: LearnedLessonKind
  summary: string
  detail: string | null
  scope: WorkflowScope
  tags: string[]
  sourceDetail: string | null
}

export interface LessonSaveResult {
  /** The stored lesson, or null when it was refused. */
  saved: LearnedLesson | null
  reason?: 'invalid_lesson' | 'sensitive_blocked' | 'shared_scope_requires_approval'
}

/**
 * Channel D - a sanitized record that a FUTURE, opt-in fine-tuning step could use
 * to train an open-source/local model. Producing these records does NOT train
 * anything; it only prepares safe, generic examples.
 */
export interface FineTuningRecord {
  /** A user-style request derived from a generic trigger phrase. */
  instruction: string
  /** Generic context about the task (apps, scope). */
  context: string
  /** Generic, structure-only description of how the task is done. */
  response: string
  tags: string[]
  scope: WorkflowScope
  source: 'seed_or_workflow' | 'lesson'
}

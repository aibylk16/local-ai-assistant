import type { WorkflowScope, WorkflowStep, WorkflowStepKind } from '../workflows/types.js'

/**
 * Teaching Mode - the user teaches a task once, the assistant records generic
 * steps, and an approved, sanitized workflow template comes out the other end.
 *
 * HONESTY NOTE: this is NOT model training or fine-tuning. No LLM weights are
 * updated. "Learning" here means recording, sanitizing, and reusing workflow
 * structure and preferences. A local or cloud LLM remains an optional future
 * upgrade and is not required for any of this to work.
 */

export type TeachingSessionStatus = 'recording' | 'drafted' | 'promoted' | 'discarded'

export interface TeachingStepInput {
  kind: WorkflowStepKind
  instruction: string
  app?: string
  target?: string
  selectorHint?: string
  /**
   * Temporary context the user provided while teaching (e.g. "this is the
   * supplier mail I mean"). LOCAL-ONLY: kept with the raw session so the user
   * can review what they taught, but NEVER copied into the workflow draft or
   * any promoted template, regardless of scope.
   */
  rawContext?: string
}

export interface TeachingStep {
  id: number
  sessionId: number
  createdAt: string
  /** 0-based order within the session. */
  position: number
  kind: WorkflowStepKind
  instruction: string
  app?: string
  target?: string
  selectorHint?: string
  rawContext?: string
}

/**
 * A correction the user gave during or after teaching ("no - filter by last
 * month first"). Corrections with a `stepPosition` replace that step's
 * instruction in the next draft; whole-session corrections (null) are appended
 * to the draft description.
 */
export interface LearnedCorrection {
  id: number
  sessionId: number
  createdAt: string
  stepPosition: number | null
  instruction: string
}

export interface LearnedCorrectionInput {
  stepPosition?: number | null
  instruction: string
}

export interface TeachingSession {
  id: number
  createdAt: string
  updatedAt: string
  /** What the user said they are teaching, e.g. "monthly Amazon sales report". */
  goal: string
  status: TeachingSessionStatus
}

/**
 * The sanitized, reviewable output of a teaching session. Contains workflow
 * STRUCTURE only - no raw context, no message bodies, no contact data. This is
 * what the user reviews before deciding the reuse scope.
 */
export interface WorkflowDraft {
  sessionId: number
  name: string
  description: string
  triggerPhrases: string[]
  steps: WorkflowStep[]
  apps: string[]
  tags: string[]
  /**
   * Things the user should look at before approving: redactions that were
   * applied, steps upgraded to require final confirmation, steps whose
   * instruction looks too vague to replay reliably.
   */
  warnings: string[]
}

/** Explicit user decision to store a draft as a reusable workflow template. */
export interface WorkflowPromotionRequest {
  sessionId: number
  scope: WorkflowScope
  /**
   * Must be true for 'team' and 'global'. Recording it explicitly (rather than
   * inferring from the method call) keeps the approval auditable.
   */
  approvedByUser: boolean
  sourceUserId?: string | null
}

export interface WorkflowPromotionResult {
  /** The stored template, or null when promotion was refused. */
  promotedTemplateId: number | null
  reason?:
    | 'session_not_found'
    | 'not_drafted'
    | 'approval_required'
    | 'sensitive_blocked'
    | 'shared_scope_requires_approval'
}

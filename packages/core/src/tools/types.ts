import type { PermissionCategory, RiskLevel } from '../permissions/types.js'

export interface ToolContext {
  /** Audit logger so tools can record what they did. */
  audit: { record: (e: { actor: 'agent'; action: string; risk: RiskLevel; result: 'ok' | 'denied' | 'error'; detail?: unknown }) => void }
}

export interface ToolPlan<TInput = unknown> {
  toolName: string
  input: TInput
  /** Human-readable description shown in the confirmation modal. */
  description: string
  /** What data will be sent or changed — shown in the confirmation modal. */
  dataPreview?: string
  risk: RiskLevel
  requiredPermissions: PermissionCategory[]
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  risk: RiskLevel
  requiredPermissions: PermissionCategory[]
  /**
   * Build a plan (no side effects). The agent presents this to the user
   * and only after confirmation calls `execute`.
   */
  plan(input: TInput): ToolPlan<TInput>
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>
}

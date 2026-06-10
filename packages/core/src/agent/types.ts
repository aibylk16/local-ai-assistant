import type { ToolPlan } from '../tools/types.js'

export interface AgentTurnInput {
  text: string
  /** History of the conversation, oldest first. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AgentTurnOutput {
  /** Text the assistant says back. Always present. */
  reply: string
  /**
   * Plan that requires user confirmation before execution. If undefined,
   * the assistant didn't propose a side-effecting action.
   */
  pendingPlan?: ToolPlan
  /**
   * If true, the reply explicitly notes that the assistant declined or could
   * not act because of a missing permission. The renderer uses this to nudge
   * the user toward the Permission Center.
   */
  permissionBlocked?: string[]
}

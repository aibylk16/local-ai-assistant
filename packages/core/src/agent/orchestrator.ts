import type { AuditLogService } from '../audit/service.js'
import type { MemoryService } from '../memory/service.js'
import type { PermissionEngine } from '../permissions/engine.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { ModelProvider } from '../providers/types.js'
import { PermissionDeniedError, type PermissionCategory } from '../permissions/types.js'
import type { ToolPlan } from '../tools/types.js'
import type { AgentTurnInput, AgentTurnOutput } from './types.js'

export interface OrchestratorOptions {
  permissions: PermissionEngine
  memory: MemoryService
  audit: AuditLogService
  tools: ToolRegistry
  provider: ModelProvider
  /** When true, no cloud calls. UI must reflect this. */
  localOnlyMode: boolean
}

/**
 * Agent orchestrator. Single rule: nothing with side effects runs until the
 * permission engine says yes AND the user has confirmed the plan in the UI.
 */
export class AgentOrchestrator {
  constructor(private readonly opts: OrchestratorOptions) {}

  /**
   * Run one turn. Produces a reply and, optionally, a pending plan the UI
   * must surface in a confirmation modal. This method NEVER executes a tool.
   */
  async turn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const history = (input.history ?? []).map((m) => ({ role: m.role, content: m.content }))
    const completion = await this.opts.provider.complete({
      messages: [
        {
          role: 'system',
          content:
            'You are a local-first assistant. You may propose tools, but every side-effect requires user confirmation. ' +
            'Never invent permissions the user has not granted.',
        },
        ...history,
        { role: 'user', content: input.text },
      ],
    })

    let pendingPlan: ToolPlan | undefined
    const blocked: PermissionCategory[] = []

    if (completion.suggestedTool) {
      const tool = this.opts.tools.get(completion.suggestedTool.toolName)
      if (tool) {
        const plan = tool.plan(completion.suggestedTool.input)
        const missing = plan.requiredPermissions.filter(
          (p) => !this.opts.permissions.isGranted(p),
        )
        if (missing.length === 0) {
          pendingPlan = plan
        } else {
          blocked.push(...missing)
          this.opts.audit.record({
            actor: 'agent',
            action: 'tool.plan.blocked',
            risk: plan.risk,
            result: 'denied',
            detail: { tool: tool.name, missing },
          })
        }
      }
    }

    this.opts.audit.record({
      actor: 'agent',
      action: 'chat.turn',
      risk: 'low',
      result: 'ok',
      detail: { provider: this.opts.provider.info.id, localOnly: this.opts.localOnlyMode },
    })

    return {
      reply: completion.text,
      ...(pendingPlan && { pendingPlan }),
      ...(blocked.length > 0 && { permissionBlocked: blocked }),
    }
  }

  /**
   * Execute a plan AFTER the user confirmed it in the UI. Re-checks
   * permissions because they may have been revoked since the plan was built.
   */
  async executePlan(plan: ToolPlan): Promise<{ ok: boolean; output?: unknown; error?: string }> {
    const tool = this.opts.tools.get(plan.toolName)
    if (!tool) {
      this.opts.audit.record({
        actor: 'agent',
        action: 'tool.exec',
        risk: plan.risk,
        result: 'error',
        detail: { tool: plan.toolName, error: 'unknown_tool' },
      })
      return { ok: false, error: 'unknown_tool' }
    }
    try {
      for (const p of plan.requiredPermissions) this.opts.permissions.require(p)
      const output = await tool.execute(plan.input, {
        audit: {
          record: (e) => this.opts.audit.record(e),
        },
      })
      this.opts.audit.record({
        actor: 'agent',
        action: 'tool.exec',
        risk: plan.risk,
        result: 'ok',
        detail: { tool: plan.toolName },
      })
      return { ok: true, output }
    } catch (e) {
      const denied = e instanceof PermissionDeniedError
      this.opts.audit.record({
        actor: 'agent',
        action: 'tool.exec',
        risk: plan.risk,
        result: denied ? 'denied' : 'error',
        detail: {
          tool: plan.toolName,
          error: e instanceof Error ? e.message : String(e),
        },
      })
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
}

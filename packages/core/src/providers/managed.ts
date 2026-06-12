import type { AuditLogService } from '../audit/service.js'
import {
  CloudNotApprovedError,
  LocalOnlyModeBlockedError,
  MissingApiKeyError,
} from './errors.js'
import type { ProviderSettingsStore } from './settings-store.js'
import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
  ProviderId,
  ProviderInfo,
} from './types.js'

export type ProviderRegistry = Record<ProviderId, ModelProvider>

/**
 * Single {@link ModelProvider} that the orchestrator talks to. It looks up the
 * currently-selected inner provider on every call, and refuses to dispatch to
 * a cloud provider unless:
 *
 *   1. local-only mode is OFF, and
 *   2. the user has explicitly approved that provider.
 *
 * Every cloud call (or blocked attempt) is written to the audit log.
 *
 * This is the only point of enforcement for the "no data leaves the machine
 * without consent" rule. The renderer cannot bypass it because every chat
 * request runs through {@link AgentOrchestrator} which only knows about this
 * single provider.
 */
export class ManagedProvider implements ModelProvider {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly settings: ProviderSettingsStore,
    private readonly audit: AuditLogService,
  ) {}

  get info(): ProviderInfo {
    const id = this.settings.selectedProvider()
    return (this.registry[id] ?? this.registry.mock).info
  }

  /** Snapshot of the inner-provider info for diagnostics — never used as a gate. */
  innerInfo(): ProviderInfo {
    return this.info
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const id = this.settings.selectedProvider()
    const inner = this.registry[id] ?? this.registry.mock

    if (!inner.info.local) {
      if (this.settings.localOnlyMode()) {
        this.audit.record({
          actor: 'agent',
          action: 'provider.cloud.blocked',
          risk: 'medium',
          result: 'denied',
          detail: { provider: id, reason: 'local_only_mode' },
        })
        throw new LocalOnlyModeBlockedError(id)
      }
      if (!this.settings.isCloudApproved(id)) {
        this.audit.record({
          actor: 'agent',
          action: 'provider.cloud.blocked',
          risk: 'medium',
          result: 'denied',
          detail: { provider: id, reason: 'not_approved' },
        })
        throw new CloudNotApprovedError(id)
      }
    }

    try {
      const out = await inner.complete(req)
      if (!inner.info.local) {
        this.audit.record({
          actor: 'agent',
          action: 'provider.cloud.call',
          risk: 'medium',
          result: 'ok',
          detail: {
            provider: id,
            messageCount: req.messages.length,
          },
        })
      }
      return out
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        this.audit.record({
          actor: 'agent',
          action: 'provider.cloud.error',
          risk: 'medium',
          result: 'error',
          detail: { provider: id, reason: 'missing_api_key' },
        })
      } else if (!inner.info.local) {
        this.audit.record({
          actor: 'agent',
          action: 'provider.cloud.error',
          risk: 'medium',
          result: 'error',
          detail: {
            provider: id,
            error: e instanceof Error ? e.message : String(e),
          },
        })
      }
      throw e
    }
  }
}

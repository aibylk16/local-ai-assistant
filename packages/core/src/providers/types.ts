export type ProviderId = 'mock' | 'openai' | 'anthropic'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionRequest {
  messages: ChatMessage[]
  /**
   * What permissions/tools the assistant is allowed to suggest. The orchestrator
   * filters tool suggestions before showing the user a confirmation modal.
   */
  toolHints?: string[]
}

export interface CompletionResponse {
  /** Final assistant text. */
  text: string
  /**
   * Optional suggested tool call. The orchestrator will require user
   * confirmation before invoking it, regardless of risk level.
   */
  suggestedTool?: {
    toolName: string
    input: unknown
    rationale: string
  }
}

export interface ProviderInfo {
  id: ProviderId | string
  /** Human-readable label for UI. */
  label: string
  /** True if all calls happen on-device. */
  local: boolean
  /** What this provider may receive from the assistant. Shown in UI before enabling. */
  dataSentNotice: string
  /** True if this provider must show an approval modal before its first call. */
  requiresApproval: boolean
  /** Origin used for network calls. Surfaced in the approval UI. Optional for local providers. */
  apiOrigin?: string
  /** Env var name that should hold the API key, if any. Surfaced in UI. */
  apiKeyEnvVar?: string
}

export interface ModelProvider {
  info: ProviderInfo
  complete(req: CompletionRequest): Promise<CompletionResponse>
  /**
   * Cloud providers expose this so the UI can show "key detected ✔" / "key missing".
   * Local providers should return true.
   */
  hasApiKey?(): boolean
}

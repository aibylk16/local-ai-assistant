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
  id: string
  /** Human-readable label for UI. */
  label: string
  /** True if all calls happen on-device. */
  local: boolean
  /** What this provider may receive from the assistant. Shown in UI before enabling. */
  dataSentNotice: string
}

export interface ModelProvider {
  info: ProviderInfo
  complete(req: CompletionRequest): Promise<CompletionResponse>
}

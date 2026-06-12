import { MissingApiKeyError, ProviderHttpError } from './errors.js'
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
  ProviderInfo,
} from './types.js'

export interface AnthropicProviderOptions {
  apiKey: string | undefined
  /** Model id; defaults to a small, fast Claude model. */
  model?: string
  /** Max tokens for the response. */
  maxTokens?: number
  /** Override fetch (used in tests). */
  fetchImpl?: typeof fetch
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>
}

/**
 * Anthropic Messages API adapter. Construction never throws — a missing key
 * raises {@link MissingApiKeyError} only when `complete()` is called.
 *
 * The managed-provider gate ({@link ManagedProvider}) enforces approval and
 * local-only mode before this provider ever sees a request.
 */
export class AnthropicProvider implements ModelProvider {
  readonly info: ProviderInfo
  private readonly model: string
  private readonly maxTokens: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: AnthropicProviderOptions) {
    this.model = opts.model ?? 'claude-haiku-4-5-20251001'
    this.maxTokens = opts.maxTokens ?? 1024
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.info = {
      id: 'anthropic',
      label: 'Anthropic (Claude)',
      local: false,
      requiresApproval: true,
      apiOrigin: 'https://api.anthropic.com',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      dataSentNotice:
        'Your chat input and the recent conversation are sent over HTTPS to Anthropic (api.anthropic.com). ' +
        'Memory items are NOT sent unless you explicitly enable memory sharing in Settings → AI Provider.',
    }
  }

  hasApiKey(): boolean {
    return !!this.opts.apiKey
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    if (!this.opts.apiKey) {
      throw new MissingApiKeyError('anthropic', 'ANTHROPIC_API_KEY')
    }
    const system = req.messages
      .filter((m): m is ChatMessage => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages,
    }
    if (system) body['system'] = system

    const r = await this.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new ProviderHttpError('anthropic', r.status, text.slice(0, 240))
    }
    const data = (await r.json()) as AnthropicMessagesResponse
    const text =
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? ''
    return { text }
  }
}

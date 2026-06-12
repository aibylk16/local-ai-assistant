import { MissingApiKeyError, ProviderHttpError } from './errors.js'
import type {
  CompletionRequest,
  CompletionResponse,
  ModelProvider,
  ProviderInfo,
} from './types.js'

export interface OpenAIProviderOptions {
  apiKey: string | undefined
  /** Model id; defaults to a small, low-cost chat model. */
  model?: string
  /** Override fetch (used in tests). */
  fetchImpl?: typeof fetch
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * OpenAI Chat Completions adapter. Construction never throws — a missing key
 * raises {@link MissingApiKeyError} only when `complete()` is called, so the
 * UI can build the provider list even with no key configured.
 *
 * The managed-provider gate ({@link ManagedProvider}) enforces approval and
 * local-only mode before this provider ever sees a request.
 */
export class OpenAIProvider implements ModelProvider {
  readonly info: ProviderInfo
  private readonly model: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: OpenAIProviderOptions) {
    this.model = opts.model ?? 'gpt-4o-mini'
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.info = {
      id: 'openai',
      label: 'OpenAI',
      local: false,
      requiresApproval: true,
      apiOrigin: 'https://api.openai.com',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      dataSentNotice:
        'Your chat input and the recent conversation are sent over HTTPS to OpenAI (api.openai.com). ' +
        'Memory items are NOT sent unless you explicitly enable memory sharing in Settings → AI Provider.',
    }
  }

  hasApiKey(): boolean {
    return !!this.opts.apiKey
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    if (!this.opts.apiKey) {
      throw new MissingApiKeyError('openai', 'OPENAI_API_KEY')
    }
    const body = {
      model: this.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    }
    const r = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new ProviderHttpError('openai', r.status, text.slice(0, 240))
    }
    const data = (await r.json()) as OpenAIChatResponse
    const text = data.choices?.[0]?.message?.content ?? ''
    return { text }
  }
}

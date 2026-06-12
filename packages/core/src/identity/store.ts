import type { DB } from '../db/types.js'
import type { AuditLogService } from '../audit/service.js'
import type { AssistantIdentity, AssistantIdentityInput, VoiceStyle } from './types.js'
import { checkAssistantName, wakePhraseFor } from './common-names.js'

export class IdentityValidationError extends Error {
  readonly code = 'invalid_identity'
  constructor(message: string) {
    super(message)
    this.name = 'IdentityValidationError'
  }
}

const DEFAULTS: Record<string, string> = {
  configured: '0',
  assistant_name: '',
  voice_style: 'neutral',
  company_label: '',
}

/**
 * SQLite-backed store for the assistant identity (name, wake phrase, voice
 * style, optional company label). Local-only — there is no cloud sync until
 * the cloud backend exists AND the user approves sync (roadmap Phase 4).
 *
 * Defaults are conservative: unconfigured, no name, neutral voice. There is
 * intentionally no built-in default assistant name — each user/company picks
 * one (docs/assistant-identity.md).
 *
 * Every change writes an `identity.update` audit entry with old → new values
 * and any common-name warning the user overrode. The actor is always 'user':
 * the agent must never rename itself.
 */
export class AssistantIdentityStore {
  constructor(
    private readonly db: DB,
    private readonly audit: AuditLogService,
  ) {
    this.ensureRows()
  }

  private ensureRows(): void {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO identity_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    )
    const ts = new Date().toISOString()
    for (const [k, v] of Object.entries(DEFAULTS)) insert.run(k, v, ts)
  }

  private read(key: string): string {
    const row = this.db
      .prepare(`SELECT value FROM identity_settings WHERE key = ?`)
      .get(key) as { value: string } | undefined
    return row?.value ?? ''
  }

  private write(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO identity_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, new Date().toISOString())
  }

  isConfigured(): boolean {
    return this.read('configured') === '1'
  }

  snapshot(): AssistantIdentity {
    const name = this.read('assistant_name')
    const style = this.read('voice_style')
    const company = this.read('company_label')
    return {
      configured: this.isConfigured(),
      assistantName: name,
      wakePhrase: wakePhraseFor(name),
      voiceStyle: style === 'female' || style === 'male' ? style : 'neutral',
      companyLabel: company.length > 0 ? company : undefined,
    }
  }

  /**
   * Set or update the identity. Throws {@link IdentityValidationError} on an
   * unusable name or voice style. A risky common name (Alexa, Siri, …) does
   * NOT throw — the UI is responsible for showing the warning first — but the
   * overridden warning is recorded in the audit entry.
   */
  setIdentity(input: AssistantIdentityInput): AssistantIdentity {
    const check = checkAssistantName(input.assistantName)
    if (!check.valid) {
      throw new IdentityValidationError(check.reason ?? 'Invalid assistant name.')
    }
    if (!isVoiceStyle(input.voiceStyle)) {
      throw new IdentityValidationError(
        `Voice style must be 'female', 'male', or 'neutral'.`,
      )
    }

    const before = this.snapshot()
    const name = input.assistantName.trim()
    const company = input.companyLabel?.trim() ?? ''

    this.write('assistant_name', name)
    this.write('voice_style', input.voiceStyle)
    this.write('company_label', company)
    this.write('configured', '1')

    const after = this.snapshot()
    this.audit.record({
      actor: 'user',
      action: 'identity.update',
      risk: 'low',
      result: 'ok',
      detail: {
        before: {
          assistantName: before.assistantName,
          voiceStyle: before.voiceStyle,
          companyLabel: before.companyLabel ?? null,
        },
        after: {
          assistantName: after.assistantName,
          voiceStyle: after.voiceStyle,
          companyLabel: after.companyLabel ?? null,
        },
        wakePhrase: after.wakePhrase,
        overriddenWarning: check.warning ?? null,
      },
    })
    return after
  }
}

function isVoiceStyle(v: string): v is VoiceStyle {
  return v === 'female' || v === 'male' || v === 'neutral'
}

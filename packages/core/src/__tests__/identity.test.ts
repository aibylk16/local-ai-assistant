import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  applySchema,
  AssistantIdentityStore,
  AuditLogService,
  checkAssistantName,
  IdentityValidationError,
  MAX_ASSISTANT_NAME_LENGTH,
  wakePhraseFor,
} from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

describe('checkAssistantName', () => {
  it('accepts normal unique names', () => {
    for (const name of ['Tara', 'Nova', 'Riva', 'Arya', 'Vani']) {
      expect(checkAssistantName(name)).toEqual({ valid: true })
    }
  })

  it('rejects empty and whitespace-only names', () => {
    expect(checkAssistantName('').valid).toBe(false)
    expect(checkAssistantName('   ').valid).toBe(false)
  })

  it('rejects names longer than the limit', () => {
    const result = checkAssistantName('x'.repeat(MAX_ASSISTANT_NAME_LENGTH + 1))
    expect(result.valid).toBe(false)
  })

  it('rejects names with control characters', () => {
    const tab = String.fromCharCode(9)
    const nul = String.fromCharCode(0)
    const del = String.fromCharCode(127)
    expect(checkAssistantName(`Ta${tab}ra`).valid).toBe(false)
    expect(checkAssistantName(`Ta${nul}ra`).valid).toBe(false)
    expect(checkAssistantName(`Tara${del}x`).valid).toBe(false)
  })

  it('warns on ecosystem-colliding names, case-insensitively', () => {
    for (const name of ['Alexa', 'siri', 'GOOGLE', 'Cortana', 'bixby', 'Echo']) {
      const result = checkAssistantName(name)
      expect(result.valid).toBe(true)
      expect(result.warning).toBeTruthy()
    }
  })

  it('warns on overly generic names', () => {
    for (const name of ['Computer', 'assistant', 'AI', 'hey']) {
      const result = checkAssistantName(name)
      expect(result.valid).toBe(true)
      expect(result.warning).toBeTruthy()
    }
  })
})

describe('wakePhraseFor', () => {
  it('derives "Hey <name>"', () => {
    expect(wakePhraseFor('Tara')).toBe('Hey Tara')
    expect(wakePhraseFor('  Nova  ')).toBe('Hey Nova')
  })

  it('is empty when no name is configured', () => {
    expect(wakePhraseFor('')).toBe('')
  })
})

describe('AssistantIdentityStore', () => {
  let db: Database.Database
  let audit: AuditLogService
  let store: AssistantIdentityStore

  beforeEach(() => {
    db = makeDb()
    audit = new AuditLogService(db)
    store = new AssistantIdentityStore(db, audit)
  })
  afterEach(() => db.close())

  it('starts unconfigured with no default assistant name', () => {
    const id = store.snapshot()
    expect(id.configured).toBe(false)
    expect(id.assistantName).toBe('')
    expect(id.wakePhrase).toBe('')
    expect(id.voiceStyle).toBe('neutral')
    expect(id.companyLabel).toBeUndefined()
  })

  it('stores name, voice style, and company label; derives wake phrase', () => {
    const id = store.setIdentity({
      assistantName: 'Tara',
      voiceStyle: 'female',
      companyLabel: 'Acme Pvt Ltd',
    })
    expect(id.configured).toBe(true)
    expect(id.assistantName).toBe('Tara')
    expect(id.wakePhrase).toBe('Hey Tara')
    expect(id.voiceStyle).toBe('female')
    expect(id.companyLabel).toBe('Acme Pvt Ltd')
  })

  it('persists across instances on the same db', () => {
    store.setIdentity({ assistantName: 'Nova', voiceStyle: 'male' })
    const second = new AssistantIdentityStore(db, audit)
    const id = second.snapshot()
    expect(id.assistantName).toBe('Nova')
    expect(id.voiceStyle).toBe('male')
    expect(id.configured).toBe(true)
  })

  it('allows editing name and voice style anytime', () => {
    store.setIdentity({ assistantName: 'Tara', voiceStyle: 'female' })
    const id = store.setIdentity({ assistantName: 'Riva', voiceStyle: 'neutral' })
    expect(id.assistantName).toBe('Riva')
    expect(id.wakePhrase).toBe('Hey Riva')
    expect(id.voiceStyle).toBe('neutral')
  })

  it('rejects invalid names without writing anything', () => {
    expect(() =>
      store.setIdentity({ assistantName: '   ', voiceStyle: 'neutral' }),
    ).toThrow(IdentityValidationError)
    expect(store.isConfigured()).toBe(false)
  })

  it('rejects unknown voice styles', () => {
    expect(() =>
      store.setIdentity({
        assistantName: 'Tara',
        voiceStyle: 'robot' as unknown as 'neutral',
      }),
    ).toThrow(IdentityValidationError)
  })

  it('writes an identity.update audit entry with before/after values', () => {
    store.setIdentity({ assistantName: 'Tara', voiceStyle: 'female' })
    store.setIdentity({ assistantName: 'Vani', voiceStyle: 'neutral' })
    const entries = audit.recent().filter((e) => e.action === 'identity.update')
    expect(entries.length).toBe(2)
    const latest = entries[0]!.detail as {
      before: { assistantName: string }
      after: { assistantName: string }
      wakePhrase: string
      overriddenWarning: string | null
    }
    expect(latest.before.assistantName).toBe('Tara')
    expect(latest.after.assistantName).toBe('Vani')
    expect(latest.wakePhrase).toBe('Hey Vani')
    expect(latest.overriddenWarning).toBeNull()
  })

  it('records the overridden warning when a risky common name is chosen', () => {
    store.setIdentity({ assistantName: 'Alexa', voiceStyle: 'neutral' })
    const entry = audit.recent().find((e) => e.action === 'identity.update')
    const detail = entry?.detail as { overriddenWarning: string | null }
    expect(detail.overriddenWarning).toBeTruthy()
  })
})

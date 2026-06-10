import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { applySchema, MemoryService, looksSensitive } from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

describe('looksSensitive', () => {
  it('flags card-shaped digits', () => {
    expect(looksSensitive('card 4111 1111 1111 1111')).toBe(true)
  })
  it('flags OTPs and JWTs', () => {
    expect(looksSensitive('your otp is 123456')).toBe(true)
    expect(looksSensitive('Bearer eyJhbGciOiJIUzI1.eyJzdWIiOiJhYmM.signaturehere')).toBe(true)
  })
  it('lets plain notes through', () => {
    expect(looksSensitive('Priya prefers Tuesday meetings, 30 min max.')).toBe(false)
  })
})

describe('MemoryService', () => {
  let db: Database.Database
  let mem: MemoryService

  beforeEach(() => {
    db = makeDb()
    mem = new MemoryService(db)
  })
  afterEach(() => db.close())

  it('saveCandidate refuses sensitive content', () => {
    const r = mem.saveCandidate({
      kind: 'note',
      title: 'leak',
      body: 'password: hunter2',
    })
    expect(r.saved).toBeNull()
    expect(r.reason).toBe('sensitive_blocked')
    expect(mem.list().length).toBe(0)
  })

  it('saveManually bypasses the sensitive blocker', () => {
    const item = mem.saveManually({
      kind: 'preference',
      title: 'gst',
      body: 'My GST number is 27ABCDE1234F1Z5',
    })
    expect(item.reviewed).toBe(true)
    expect(mem.list().length).toBe(1)
  })

  it('upserts on (kind, key)', () => {
    mem.saveManually({ kind: 'preference', key: 'reply-tone', title: 'tone', body: 'brief' })
    mem.saveManually({ kind: 'preference', key: 'reply-tone', title: 'tone', body: 'warm and brief' })
    const list = mem.list({ kind: 'preference' })
    expect(list.length).toBe(1)
    expect(list[0]?.body).toBe('warm and brief')
  })

  it('delete and deleteAll work', () => {
    const a = mem.saveManually({ kind: 'note', title: 'a', body: '1' })
    mem.saveManually({ kind: 'note', title: 'b', body: '2' })
    expect(mem.delete(a.id)).toBe(true)
    expect(mem.list().length).toBe(1)
    expect(mem.deleteAll()).toBe(1)
    expect(mem.list().length).toBe(0)
  })
})

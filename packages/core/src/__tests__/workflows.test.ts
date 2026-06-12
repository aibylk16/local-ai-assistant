import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { applySchema, AuditLogService, WorkflowTemplateStore } from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

describe('WorkflowTemplateStore', () => {
  let db: Database.Database
  let store: WorkflowTemplateStore

  beforeEach(() => {
    db = makeDb()
    store = new WorkflowTemplateStore(db, new AuditLogService(db))
  })

  afterEach(() => db.close())

  it('stores a private taught workflow without cloud API dependency', () => {
    const result = store.save({
      scope: 'private',
      name: 'Amazon sales Excel analysis',
      description: 'Download sales report and build a monthly spreadsheet summary.',
      triggerPhrases: ['download amazon sales data and make excel analysis'],
      steps: [
        { kind: 'open_url', app: 'browser', target: 'Amazon Seller Central', instruction: 'Open the reports page.' },
        { kind: 'download', app: 'browser', instruction: 'Download the latest sales report.' },
        { kind: 'transform_table', app: 'excel', instruction: 'Clean columns and create a monthly summary.' },
      ],
      tags: ['amazon', 'excel', 'analysis'],
    })

    expect(result.saved?.id).toBeGreaterThan(0)
    expect(result.saved?.requiresApproval).toBe(true)
    expect(result.saved?.steps[1]?.dataPolicy).toBe('uses_current_user_data')
  })

  it('blocks sensitive content before saving workflow learning', () => {
    const result = store.save({
      scope: 'private',
      name: 'Login workflow',
      description: 'Use password: hunter2 to log in.',
      triggerPhrases: ['login'],
      steps: [{ kind: 'type', instruction: 'Type password: hunter2' }],
    })

    expect(result.saved).toBeNull()
    expect(result.reason).toBe('sensitive_blocked')
    expect(store.list()).toHaveLength(0)
  })

  it('requires explicit approval before storing team or global reusable workflows', () => {
    const result = store.save({
      scope: 'team',
      name: 'Unread email triage',
      description: 'Open mail, inspect unread messages, and classify which need a reply.',
      triggerPhrases: ['check unread emails that need reply'],
      steps: [{ kind: 'observe', app: 'gmail', instruction: 'Read unread message list.' }],
    })

    expect(result.saved).toBeNull()
    expect(result.reason).toBe('shared_scope_requires_approval')
  })

  it('sanitizes reusable shared workflow details', () => {
    const result = store.save({
      scope: 'global',
      approvedForReuse: true,
      name: 'Email follow up',
      description: 'Draft follow ups without saving private message bodies.',
      triggerPhrases: ['reply to unread email'],
      sourceDetail: 'Taught by laxmi@example.com for phone +91 98765 43210',
      steps: [
        {
          kind: 'draft_message',
          app: 'gmail',
          instruction: 'Draft a reply to laxmi@example.com and ask before sending.',
        },
      ],
    })

    expect(result.saved?.sourceDetail).toContain('[email]')
    expect(result.saved?.sourceDetail).toContain('[phone]')
    expect(result.saved?.steps[0]?.instruction).toContain('[email]')
    expect(result.saved?.steps[0]?.dataPolicy).toBe('requires_final_confirmation')
  })

  it('matches a later task request to a saved approved workflow', () => {
    store.save({
      scope: 'team',
      approvedForReuse: true,
      name: 'Unread email triage',
      description: 'Open mail, inspect unread messages, and classify which need a reply.',
      triggerPhrases: ['check unread emails that need reply'],
      steps: [{ kind: 'observe', app: 'gmail', instruction: 'Read unread message list.' }],
    })

    const matches = store.match('please check all unread emails and tell me what needs reply')

    expect(matches[0]?.template.name).toBe('Unread email triage')
    expect(matches[0]?.score).toBeGreaterThan(0)
  })
})

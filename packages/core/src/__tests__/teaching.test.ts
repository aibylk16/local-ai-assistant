import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  applySchema,
  AuditLogService,
  TeachingSessionError,
  TeachingSessionStore,
  WorkflowTemplateStore,
} from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

describe('TeachingSessionStore', () => {
  let db: Database.Database
  let workflows: WorkflowTemplateStore
  let store: TeachingSessionStore
  let audit: AuditLogService

  beforeEach(() => {
    db = makeDb()
    audit = new AuditLogService(db)
    workflows = new WorkflowTemplateStore(db, audit)
    store = new TeachingSessionStore(db, workflows, audit)
  })

  afterEach(() => db.close())

  it('keeps raw teaching context local only - never in drafts or templates', () => {
    const session = store.startSession('save supplier invoices to folder')
    store.addStep(session.id, {
      kind: 'observe',
      app: 'gmail',
      instruction: 'Open the supplier invoice email.',
      rawContext: 'Example mail: invoice 99887766 from customer Ramesh for Rs 45,000',
    })
    store.addStep(session.id, {
      kind: 'download',
      app: 'gmail',
      instruction: 'Download the attached invoice PDF.',
    })
    store.addStep(session.id, {
      kind: 'create_file',
      app: 'explorer',
      instruction: 'Save the file into the invoices folder.',
    })

    // The raw session keeps the temporary context locally so the user can review it.
    const steps = store.getSteps(session.id)
    expect(steps[0]?.rawContext).toContain('Ramesh')

    // The draft is built ONLY from sanitized structure.
    const draft = store.createDraft(session.id)
    const draftJson = JSON.stringify(draft)
    expect(draftJson).not.toContain('Ramesh')
    expect(draftJson).not.toContain('99887766')
    expect(draftJson).not.toContain('45,000')

    // And the promoted template carries none of it either.
    const result = store.approveDraft({ sessionId: session.id, scope: 'team', approvedByUser: true })
    const template = workflows.get(result.promotedTemplateId!)
    expect(JSON.stringify(template)).not.toContain('Ramesh')
  })

  it('sanitizes private data out of the workflow draft', () => {
    const session = store.startSession('email follow up')
    store.addStep(session.id, {
      kind: 'draft_message',
      app: 'gmail',
      instruction: 'Draft a reply to laxmi@example.com about order, call +91 98765 43210 if urgent.',
    })

    const draft = store.createDraft(session.id)
    expect(draft.steps[0]?.instruction).toContain('[email]')
    expect(draft.steps[0]?.instruction).toContain('[phone]')
    expect(draft.steps[0]?.instruction).not.toContain('laxmi@example.com')
    expect(draft.warnings.some((w) => w.includes('redacted'))).toBe(true)
  })

  it('refuses team and global promotion without explicit user approval', () => {
    const session = store.startSession('check unread emails that need reply')
    store.addStep(session.id, {
      kind: 'observe',
      app: 'gmail',
      instruction: 'Read the unread message list and classify which need replies.',
    })
    store.createDraft(session.id)

    const team = store.approveDraft({ sessionId: session.id, scope: 'team', approvedByUser: false })
    expect(team.promotedTemplateId).toBeNull()
    expect(team.reason).toBe('approval_required')

    const global = store.approveDraft({ sessionId: session.id, scope: 'global', approvedByUser: false })
    expect(global.promotedTemplateId).toBeNull()
    expect(global.reason).toBe('approval_required')

    // The blocked attempts are visible in the audit log.
    const blocked = audit.recent().filter((e) => e.action === 'teaching.promotion.blocked')
    expect(blocked.length).toBe(2)

    const approved = store.approveDraft({ sessionId: session.id, scope: 'team', approvedByUser: true })
    expect(approved.promotedTemplateId).toBeGreaterThan(0)
    expect(store.getSession(session.id)?.status).toBe('promoted')
  })

  it('applies user corrections to the next workflow draft', () => {
    const session = store.startSession('monthly amazon sales report')
    store.addStep(session.id, {
      kind: 'open_url',
      app: 'browser',
      instruction: 'Open the Amazon seller reports page.',
    })
    store.addStep(session.id, {
      kind: 'transform_table',
      app: 'excel',
      instruction: 'Create a summary sheet.',
    })

    const first = store.createDraft(session.id)
    expect(first.steps[1]?.instruction).toBe('Create a summary sheet.')

    store.addCorrection(session.id, {
      stepPosition: 1,
      instruction: 'Create a summary sheet grouped by month with totals at the top.',
    })
    store.addCorrection(session.id, {
      instruction: 'Always use the same column layout as the previous report.',
    })

    // A correction reopens the session - the stale draft can no longer be promoted.
    const stale = store.approveDraft({ sessionId: session.id, scope: 'private', approvedByUser: true })
    expect(stale.reason).toBe('not_drafted')

    const redrafted = store.createDraft(session.id)
    expect(redrafted.steps[1]?.instruction).toContain('grouped by month')
    expect(redrafted.description).toContain('same column layout')
  })

  it('matches a taught workflow when a similar task arrives later', () => {
    const session = store.startSession('check unread emails that need reply')
    store.addStep(session.id, {
      kind: 'observe',
      app: 'gmail',
      instruction: 'Read the unread message list and classify which need replies.',
    })
    store.createDraft(session.id)
    store.approveDraft({ sessionId: session.id, scope: 'team', approvedByUser: true })

    const matches = workflows.match('please check my unread emails and tell me which need reply')
    expect(matches[0]?.template.name).toBe('check unread emails that need reply')
    expect(matches[0]?.score).toBeGreaterThan(0)
  })

  it('never saves a send/delete/upload/payment step without final confirmation', () => {
    const session = store.startSession('invoice follow up')
    // The teacher claims weaker policies - the sanitizer must override them.
    store.addStep(session.id, {
      kind: 'custom',
      instruction: 'Send the follow-up email to the supplier.',
    })
    store.addStep(session.id, {
      kind: 'custom',
      instruction: 'Upload the report to the portal and submit the form.',
    })
    store.addStep(session.id, {
      kind: 'custom',
      instruction: 'Delete the temporary export file.',
    })

    const draft = store.createDraft(session.id)
    for (const step of draft.steps) {
      expect(step.dataPolicy).toBe('requires_final_confirmation')
    }
    expect(draft.warnings.some((w) => w.includes('final confirmation'))).toBe(true)

    // Defense in depth: even a direct save into the template store with a
    // tampered weaker policy is upgraded.
    const direct = workflows.save({
      scope: 'private',
      name: 'pay supplier',
      description: 'Make the monthly payment.',
      triggerPhrases: ['pay supplier'],
      steps: [{ kind: 'custom', instruction: 'Pay the supplier invoice.', dataPolicy: 'no_user_data' }],
    })
    expect(direct.saved?.steps[0]?.dataPolicy).toBe('requires_final_confirmation')
  })

  it('propagates the sensitive-content block from the workflow store', () => {
    const session = store.startSession('portal login')
    store.addStep(session.id, {
      kind: 'type',
      instruction: 'Type password: hunter2 into the login box.',
    })
    store.createDraft(session.id)

    const result = store.approveDraft({ sessionId: session.id, scope: 'private', approvedByUser: true })
    expect(result.promotedTemplateId).toBeNull()
    expect(result.reason).toBe('sensitive_blocked')
    expect(store.getSession(session.id)?.status).toBe('drafted')
  })

  it('lists and deletes sessions with their steps and corrections', () => {
    const a = store.startSession('task a')
    const b = store.startSession('task b')
    store.addStep(a.id, { kind: 'observe', instruction: 'Look at the screen.' })
    store.addCorrection(a.id, { instruction: 'Zoom in first.' })

    expect(store.listSessions().map((s) => s.id).sort()).toEqual([a.id, b.id].sort())

    expect(store.deleteSession(a.id)).toBe(true)
    expect(store.getSession(a.id)).toBeNull()
    expect(store.getSteps(a.id)).toHaveLength(0)
    expect(store.getCorrections(a.id)).toHaveLength(0)
    expect(store.deleteSession(a.id)).toBe(false)
  })

  it('locks promoted sessions against further edits', () => {
    const session = store.startSession('check unread emails')
    store.addStep(session.id, { kind: 'observe', app: 'gmail', instruction: 'Read the unread list.' })
    store.createDraft(session.id)
    store.approveDraft({ sessionId: session.id, scope: 'private', approvedByUser: true })

    expect(() =>
      store.addStep(session.id, { kind: 'observe', instruction: 'One more step.' }),
    ).toThrow(TeachingSessionError)
  })
})

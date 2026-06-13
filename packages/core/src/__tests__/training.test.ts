import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  allUserFacingCopy,
  applySchema,
  AuditLogService,
  BackendTrainingImporter,
  exportFineTuningRecords,
  internalTermsIn,
  LessonStore,
  OFFICE_TASK_SEEDS,
  TRAINED_REUSE_COPY,
  WorkflowTemplateStore,
} from '../index.js'
import type { TaskSeed } from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

function genericSeed(overrides: Partial<TaskSeed> = {}): TaskSeed {
  return {
    goal: 'check unread emails that need reply',
    triggerPhrases: ['check my unread emails'],
    apps: ['gmail'],
    steps: [
      { kind: 'open_app', app: 'gmail', instruction: 'Open the email inbox.' },
      { kind: 'observe', app: 'gmail', instruction: 'Read the unread message list.' },
    ],
    requiredPermissions: ['email.read'],
    finalConfirmation: false,
    scope: 'private',
    approvedByUser: true,
    tags: ['email', 'triage'],
    ...overrides,
  }
}

describe('BackendTrainingImporter', () => {
  let db: Database.Database
  let workflows: WorkflowTemplateStore
  let importer: BackendTrainingImporter
  let audit: AuditLogService

  beforeEach(() => {
    db = makeDb()
    audit = new AuditLogService(db)
    workflows = new WorkflowTemplateStore(db, audit)
    importer = new BackendTrainingImporter(workflows, audit)
  })

  afterEach(() => db.close())

  it('saves generic backend task learning that matches later requests', () => {
    const result = importer.import(genericSeed())
    expect(result.importedTemplateId).toBeGreaterThan(0)

    const template = workflows.get(result.importedTemplateId!)
    expect(template?.name).toBe('check unread emails that need reply')
    expect(template?.scope).toBe('private')

    // The trained skill is reusable: a similar request matches it.
    const matches = workflows.match('please check my unread emails', { includePrivate: true })
    expect(matches[0]?.template.id).toBe(result.importedTemplateId)
  })

  it('blocks a seed that contains private/sensitive data instead of redacting it', () => {
    const withEmail = importer.import(
      genericSeed({
        steps: [{ kind: 'observe', instruction: 'Reply to ramesh@example.com about the order.' }],
      }),
    )
    expect(withEmail.importedTemplateId).toBeNull()
    expect(withEmail.reason).toBe('sensitive_blocked')

    const withInvoiceId = importer.import(
      genericSeed({
        steps: [{ kind: 'observe', instruction: 'Open invoice number 99887766 from the supplier.' }],
      }),
    )
    expect(withInvoiceId.importedTemplateId).toBeNull()
    expect(withInvoiceId.reason).toBe('sensitive_blocked')

    const withMoney = importer.import(
      genericSeed({ goal: 'pay supplier Rs 45,000', triggerPhrases: ['pay supplier'] }),
    )
    expect(withMoney.importedTemplateId).toBeNull()
    expect(withMoney.reason).toBe('sensitive_blocked')

    // Nothing sensitive was stored, and each refusal is audited.
    expect(workflows.list().length).toBe(0)
    const blocked = audit.recent().filter((e) => e.action === 'training.seed.blocked')
    expect(blocked.length).toBe(3)
  })

  it('does not match private backend learning until it is approved for reuse', () => {
    const result = importer.import(genericSeed({ approvedByUser: false }))
    expect(result.importedTemplateId).toBeGreaterThan(0)
    expect(workflows.get(result.importedTemplateId!)?.approvedForReuse).toBe(false)

    const matches = workflows.match('please check my unread emails', { includePrivate: true })
    expect(matches).toHaveLength(0)
  })

  it('requires explicit approval before importing team/global seeds', () => {
    const team = importer.import(genericSeed({ scope: 'team', approvedByUser: false }))
    expect(team.importedTemplateId).toBeNull()
    expect(team.reason).toBe('approval_required')

    const global = importer.import(genericSeed({ scope: 'global', approvedByUser: false }))
    expect(global.importedTemplateId).toBeNull()
    expect(global.reason).toBe('approval_required')

    // Approval can be granted on the seed...
    const approvedSeed = importer.import(genericSeed({ scope: 'team', approvedByUser: true }))
    expect(approvedSeed.importedTemplateId).toBeGreaterThan(0)

    // ...or at import time (e.g. from an admin screen), but never relaxed away.
    const approvedAtImport = importer.import(
      genericSeed({ goal: 'organize invoices by month', triggerPhrases: ['organize invoices'], scope: 'global', approvedByUser: false }),
      { approve: true },
    )
    expect(approvedAtImport.importedTemplateId).toBeGreaterThan(0)
  })

  it('never lets raw/private data enter shared (team/global) learning', () => {
    const result = importer.import(
      genericSeed({
        scope: 'global',
        approvedByUser: true,
        steps: [{ kind: 'observe', instruction: 'Check the order for customer +91 98765 43210.' }],
      }),
    )
    expect(result.importedTemplateId).toBeNull()
    expect(result.reason).toBe('sensitive_blocked')

    // Defense in depth: even if the strict seed check were bypassed, the shared
    // template store still stores no phone number.
    expect(workflows.list({ scope: 'global' }).length).toBe(0)
  })

  it('forces final confirmation on side-effect steps even when the seed says otherwise', () => {
    const result = importer.import(
      genericSeed({
        goal: 'send the follow-up note',
        triggerPhrases: ['send follow up'],
        finalConfirmation: false,
        steps: [{ kind: 'custom', instruction: 'Send the follow-up message to the contact.' }],
      }),
    )
    expect(result.importedTemplateId).toBeGreaterThan(0)
    const template = workflows.get(result.importedTemplateId!)
    expect(template?.steps[0]?.dataPolicy).toBe('requires_final_confirmation')
    expect(result.warnings.some((w) => w.includes('final confirmation'))).toBe(true)
  })

  it('imports the built-in office seeds once approved, and refuses them by default', () => {
    // The built-in shared seeds are intentionally unapproved out of the box.
    const defaultRun = importer.importAll([...OFFICE_TASK_SEEDS])
    const sharedDefaults = OFFICE_TASK_SEEDS.filter((s) => s.scope !== 'private').length
    expect(defaultRun.refused).toBeGreaterThanOrEqual(sharedDefaults)

    // An admin who reviews and approves them can import the batch.
    const approvedRun = importer.importAll([...OFFICE_TASK_SEEDS], { approve: true })
    expect(approvedRun.imported).toBe(OFFICE_TASK_SEEDS.length)
    expect(approvedRun.refused).toBe(0)
  })
})

describe('LessonStore (learning from successful work)', () => {
  let db: Database.Database
  let lessons: LessonStore
  let audit: AuditLogService

  beforeEach(() => {
    db = makeDb()
    audit = new AuditLogService(db)
    lessons = new LessonStore(db, audit)
  })

  afterEach(() => db.close())

  it('records a generic preference lesson', () => {
    const result = lessons.record({
      kind: 'output_format',
      summary: 'Group monthly reports by week with totals at the top.',
      scope: 'private',
      tags: ['report'],
    })
    expect(result.saved?.id).toBeGreaterThan(0)
    expect(lessons.list().length).toBe(1)
  })

  it('refuses a lesson that carries private data', () => {
    const result = lessons.record({
      kind: 'classification_rule',
      summary: 'Always reply to ramesh@example.com first.',
      scope: 'team',
      approvedByUser: true,
    })
    expect(result.saved).toBeNull()
    expect(result.reason).toBe('sensitive_blocked')
    expect(lessons.list().length).toBe(0)
  })

  it('requires explicit approval before storing shared lessons', () => {
    const blocked = lessons.record({
      kind: 'classification_rule',
      summary: 'Treat newsletters as no-reply unless they mention an invoice.',
      scope: 'team',
    })
    expect(blocked.saved).toBeNull()
    expect(blocked.reason).toBe('shared_scope_requires_approval')

    const approved = lessons.record({
      kind: 'classification_rule',
      summary: 'Treat newsletters as no-reply unless they mention an invoice.',
      scope: 'team',
      approvedByUser: true,
    })
    expect(approved.saved?.scope).toBe('team')
  })
})

describe('Fine-tuning export (channel D, no training performed)', () => {
  let db: Database.Database
  let workflows: WorkflowTemplateStore
  let importer: BackendTrainingImporter

  beforeEach(() => {
    db = makeDb()
    workflows = new WorkflowTemplateStore(db)
    importer = new BackendTrainingImporter(workflows)
  })

  afterEach(() => db.close())

  it('exports only sanitized shared knowledge by default', () => {
    importer.import(genericSeed({ scope: 'team', approvedByUser: true }))
    importer.import(genericSeed({ goal: 'private only skill', triggerPhrases: ['private skill'], scope: 'private' }))
    importer.import(genericSeed({ goal: 'unapproved private skill', triggerPhrases: ['unapproved private skill'], scope: 'private', approvedByUser: false }))

    const records = exportFineTuningRecords({ templates: workflows.list() })
    // Only the team record is exported; private is excluded by default.
    expect(records.length).toBe(1)
    expect(records[0]?.scope).toBe('team')
    expect(records[0]?.instruction.length).toBeGreaterThan(0)

    const withPrivate = exportFineTuningRecords({ templates: workflows.list(), includePrivate: true })
    expect(withPrivate.length).toBe(2)
    expect(withPrivate.some((record) => record.instruction.includes('unapproved'))).toBe(false)
  })
})

describe('Chat copy stays free of internal terminology', () => {
  it('never exposes workflow/template/matcher/replay/vector/fine-tune terms', () => {
    for (const copy of allUserFacingCopy()) {
      expect(internalTermsIn(copy)).toEqual([])
    }
    // Spot-check the reuse phrases read like a normal assistant.
    expect(TRAINED_REUSE_COPY.canDo).toBe('I can do that.')
    expect(internalTermsIn(TRAINED_REUSE_COPY.preparedYourWay)).toEqual([])
  })

  it('still detects internal terms if they leak into copy', () => {
    expect(internalTermsIn('A template matched, replay started.')).toContain('template')
    expect(internalTermsIn('A template matched, replay started.')).toContain('replay')
  })
})

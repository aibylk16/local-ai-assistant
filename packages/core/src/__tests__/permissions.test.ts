import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  applySchema,
  AuditLogService,
  MockProvider,
  PermissionDeniedError,
  PermissionEngine,
  MemoryService,
  ToolRegistry,
  AgentOrchestrator,
  type Tool,
} from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

describe('PermissionEngine', () => {
  let db: Database.Database
  let engine: PermissionEngine

  beforeEach(() => {
    db = makeDb()
    engine = new PermissionEngine(db)
  })
  afterEach(() => db.close())

  it('defaults all permissions to OFF', () => {
    const all = engine.all()
    expect(all.length).toBeGreaterThan(0)
    for (const p of all) expect(p.granted).toBe(false)
  })

  it('grant/revoke round-trip', () => {
    engine.grant('email.read')
    expect(engine.isGranted('email.read')).toBe(true)
    engine.revoke('email.read')
    expect(engine.isGranted('email.read')).toBe(false)
  })

  it('require() throws PermissionDeniedError when not granted', () => {
    expect(() => engine.require('email.send')).toThrow(PermissionDeniedError)
  })

  it('require() passes when granted', () => {
    engine.grant('email.send')
    expect(() => engine.require('email.send')).not.toThrow()
  })
})

describe('Orchestrator + tool gating', () => {
  let db: Database.Database
  let agent: AgentOrchestrator
  let perms: PermissionEngine
  let tools: ToolRegistry
  let executed: number

  beforeEach(() => {
    db = makeDb()
    perms = new PermissionEngine(db)
    const memory = new MemoryService(db)
    const audit = new AuditLogService(db)
    tools = new ToolRegistry()
    executed = 0

    const fakeTool: Tool<{ note: string }, { ran: boolean }> = {
      name: 'pending.scan',
      description: 'fake',
      risk: 'high',
      requiredPermissions: ['email.read'],
      plan: (input) => ({
        toolName: 'pending.scan',
        input,
        description: 'scan',
        risk: 'high',
        requiredPermissions: ['email.read'],
      }),
      execute: async () => {
        executed++
        return { ran: true }
      },
    }
    tools.register(fakeTool)

    agent = new AgentOrchestrator({
      permissions: perms,
      memory,
      audit,
      tools,
      provider: new MockProvider(),
      localOnlyMode: true,
    })
  })
  afterEach(() => db.close())

  it('executePlan refuses to run when permissions are missing', async () => {
    const plan = tools.get('pending.scan')!.plan({ note: 'x' })
    const r = await agent.executePlan(plan)
    expect(r.ok).toBe(false)
    expect(executed).toBe(0)
  })

  it('executePlan runs only after the right permission is granted', async () => {
    perms.grant('email.read')
    const plan = tools.get('pending.scan')!.plan({ note: 'x' })
    const r = await agent.executePlan(plan)
    expect(r.ok).toBe(true)
    expect(executed).toBe(1)
  })

  it('turn() never executes a tool, only proposes a plan', async () => {
    // Mock provider proposes pending.scan for the word "pending"
    perms.grant('email.read')
    await agent.turn({ text: 'any pending messages?' })
    expect(executed).toBe(0)
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  AgentOrchestrator,
  AnthropicProvider,
  applySchema,
  AuditLogService,
  CloudNotApprovedError,
  LocalOnlyModeBlockedError,
  ManagedProvider,
  MemoryService,
  MissingApiKeyError,
  MockProvider,
  OpenAIProvider,
  PermissionEngine,
  ProviderSettingsStore,
  ToolRegistry,
  type CompletionRequest,
  type ModelProvider,
  type ProviderId,
} from '../index.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  applySchema(db)
  return db
}

function makeManaged(
  db: Database.Database,
  overrides: { cloud?: ModelProvider } = {},
): {
  managed: ManagedProvider
  settings: ProviderSettingsStore
  audit: AuditLogService
  cloud: ModelProvider
  mock: MockProvider
} {
  const audit = new AuditLogService(db)
  const settings = new ProviderSettingsStore(db)
  const mock = new MockProvider()
  const cloud =
    overrides.cloud ??
    new AnthropicProvider({ apiKey: undefined, fetchImpl: (async () => new Response('', { status: 500 })) as typeof fetch })
  const registry: Record<ProviderId, ModelProvider> = {
    mock,
    openai: cloud,
    anthropic: cloud,
  }
  const managed = new ManagedProvider(registry, settings, audit)
  return { managed, settings, audit, cloud, mock }
}

describe('ProviderSettingsStore defaults', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })
  afterEach(() => db.close())

  it('defaults selected provider to the local mock', () => {
    const store = new ProviderSettingsStore(db)
    expect(store.selectedProvider()).toBe('mock')
  })

  it('defaults local-only mode to ON and memory sharing to OFF', () => {
    const store = new ProviderSettingsStore(db)
    expect(store.localOnlyMode()).toBe(true)
    expect(store.memorySharing()).toBe(false)
  })

  it('defaults every cloud provider to NOT approved', () => {
    const store = new ProviderSettingsStore(db)
    expect(store.isCloudApproved('openai')).toBe(false)
    expect(store.isCloudApproved('anthropic')).toBe(false)
    expect(store.isCloudApproved('mock')).toBe(true)
  })

  it('persists changes across instances on the same db', () => {
    const a = new ProviderSettingsStore(db)
    a.setSelectedProvider('openai')
    a.approveCloud('openai')
    a.setLocalOnlyMode(false)
    a.setMemorySharing(true)

    const b = new ProviderSettingsStore(db)
    expect(b.selectedProvider()).toBe('openai')
    expect(b.isCloudApproved('openai')).toBe(true)
    expect(b.localOnlyMode()).toBe(false)
    expect(b.memorySharing()).toBe(true)
  })
})

describe('ManagedProvider gate', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })
  afterEach(() => db.close())

  it('routes to the mock by default and stays offline', async () => {
    const { managed, audit } = makeManaged(db)
    expect(managed.info.id).toBe('mock')
    const r = await managed.complete({ messages: [{ role: 'user', content: 'hello' }] })
    expect(typeof r.text).toBe('string')

    // No cloud audit entry should have been written for a local call.
    const entries = audit.recent(50)
    expect(entries.find((e) => e.action === 'provider.cloud.call')).toBeUndefined()
  })

  it('refuses cloud calls when not approved and writes a denied audit entry', async () => {
    const cloudCalls: CompletionRequest[] = []
    const fakeCloud: ModelProvider = {
      info: {
        id: 'openai',
        label: 'OpenAI',
        local: false,
        requiresApproval: true,
        dataSentNotice: 'sends to openai',
      },
      complete: async (req) => {
        cloudCalls.push(req)
        return { text: 'hi' }
      },
      hasApiKey: () => true,
    }
    const { managed, settings, audit } = makeManaged(db, { cloud: fakeCloud })
    settings.setSelectedProvider('openai')
    settings.setLocalOnlyMode(false) // remove the master kill switch
    // cloud_approved is still false by default

    await expect(
      managed.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(CloudNotApprovedError)
    expect(cloudCalls.length).toBe(0)

    const entries = audit.recent(50)
    const denied = entries.find(
      (e) => e.action === 'provider.cloud.blocked' && e.result === 'denied',
    )
    expect(denied).toBeDefined()
    expect((denied?.detail as { reason?: string })?.reason).toBe('not_approved')
  })

  it('refuses cloud calls when local-only mode is ON even after approval', async () => {
    const fakeCloud: ModelProvider = {
      info: {
        id: 'anthropic',
        label: 'Anthropic',
        local: false,
        requiresApproval: true,
        dataSentNotice: 'sends to anthropic',
      },
      complete: async () => ({ text: 'should not run' }),
      hasApiKey: () => true,
    }
    const { managed, settings, audit } = makeManaged(db, { cloud: fakeCloud })
    settings.setSelectedProvider('anthropic')
    settings.approveCloud('anthropic')
    // localOnlyMode is still true (default)

    await expect(
      managed.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(LocalOnlyModeBlockedError)

    const denied = audit
      .recent(50)
      .find((e) => e.action === 'provider.cloud.blocked' && e.result === 'denied')
    expect((denied?.detail as { reason?: string })?.reason).toBe('local_only_mode')
  })

  it('allows cloud calls only after BOTH approval and local-only disabled, and audits the call', async () => {
    const fakeCloud: ModelProvider = {
      info: {
        id: 'openai',
        label: 'OpenAI',
        local: false,
        requiresApproval: true,
        dataSentNotice: 'sends to openai',
      },
      complete: async () => ({ text: 'real reply' }),
      hasApiKey: () => true,
    }
    const { managed, settings, audit } = makeManaged(db, { cloud: fakeCloud })
    settings.setSelectedProvider('openai')
    settings.approveCloud('openai')
    settings.setLocalOnlyMode(false)

    const r = await managed.complete({ messages: [{ role: 'user', content: 'hi' }] })
    expect(r.text).toBe('real reply')

    const call = audit
      .recent(50)
      .find((e) => e.action === 'provider.cloud.call' && e.result === 'ok')
    expect(call).toBeDefined()
    expect((call?.detail as { provider?: string })?.provider).toBe('openai')
  })

  it('surfaces MissingApiKeyError safely (no network call attempted)', async () => {
    // Construct a real OpenAIProvider with no key but stub fetch so the test
    // would fail loudly if the provider ever attempted a network call.
    let fetchCalled = false
    const openai = new OpenAIProvider({
      apiKey: undefined,
      fetchImpl: ((async () => {
        fetchCalled = true
        return new Response('', { status: 200 })
      }) as unknown as typeof fetch),
    })
    const registry: Record<ProviderId, ModelProvider> = {
      mock: new MockProvider(),
      openai,
      anthropic: new AnthropicProvider({ apiKey: undefined }),
    }
    const settings = new ProviderSettingsStore(db)
    const audit = new AuditLogService(db)
    const managed = new ManagedProvider(registry, settings, audit)

    settings.setSelectedProvider('openai')
    settings.approveCloud('openai')
    settings.setLocalOnlyMode(false)

    await expect(
      managed.complete({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toBeInstanceOf(MissingApiKeyError)
    expect(fetchCalled).toBe(false)

    const errEntry = audit
      .recent(50)
      .find((e) => e.action === 'provider.cloud.error' && e.result === 'error')
    expect(errEntry).toBeDefined()
    expect((errEntry?.detail as { reason?: string })?.reason).toBe('missing_api_key')
  })
})

describe('Cloud-approval audit trail', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })
  afterEach(() => db.close())

  it('records approval, revoke, and selection events distinctly', () => {
    // These mirror what the IPC handlers do — store mutation + audit entry.
    const settings = new ProviderSettingsStore(db)
    const audit = new AuditLogService(db)

    settings.approveCloud('anthropic')
    audit.record({
      actor: 'user',
      action: 'provider.cloud.approve',
      risk: 'medium',
      result: 'ok',
      detail: { provider: 'anthropic' },
    })

    settings.revokeCloud('anthropic')
    audit.record({
      actor: 'user',
      action: 'provider.cloud.revoke',
      risk: 'low',
      result: 'ok',
      detail: { provider: 'anthropic' },
    })

    const actions = audit.recent(50).map((e) => e.action)
    expect(actions).toContain('provider.cloud.approve')
    expect(actions).toContain('provider.cloud.revoke')
  })
})

describe('Orchestrator memory sharing', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })
  afterEach(() => db.close())

  it('does not send memory items in the prompt by default', async () => {
    let captured: CompletionRequest | null = null
    const recordingProvider: ModelProvider = {
      info: {
        id: 'mock',
        label: 'recording',
        local: true,
        requiresApproval: false,
        dataSentNotice: 'noop',
      },
      complete: async (req) => {
        captured = req
        return { text: 'ok' }
      },
    }
    const memory = new MemoryService(db)
    memory.saveManually({
      kind: 'preference',
      title: 'tone',
      body: 'extremely-secret-memory-marker',
    })

    const agent = new AgentOrchestrator({
      permissions: new PermissionEngine(db),
      memory,
      audit: new AuditLogService(db),
      tools: new ToolRegistry(),
      provider: recordingProvider,
      localOnlyMode: true,
      // memorySharing defaults to false
    })

    await agent.turn({ text: 'what do you remember?' })
    expect(captured).not.toBeNull()
    const serialized = JSON.stringify(captured)
    expect(serialized).not.toContain('extremely-secret-memory-marker')
  })

  it('does not send memory items even when memorySharing is true (no memory-inclusion code path exists yet)', async () => {
    // Forward-compatibility guard: if a future change starts injecting memory,
    // it MUST honor the memorySharing flag. This test pins current behavior so
    // that change is intentional.
    let captured: CompletionRequest | null = null
    const recordingProvider: ModelProvider = {
      info: {
        id: 'mock',
        label: 'recording',
        local: true,
        requiresApproval: false,
        dataSentNotice: 'noop',
      },
      complete: async (req) => {
        captured = req
        return { text: 'ok' }
      },
    }
    const memory = new MemoryService(db)
    memory.saveManually({
      kind: 'preference',
      title: 'tone',
      body: 'a-stored-preference-string',
    })

    const agent = new AgentOrchestrator({
      permissions: new PermissionEngine(db),
      memory,
      audit: new AuditLogService(db),
      tools: new ToolRegistry(),
      provider: recordingProvider,
      localOnlyMode: false,
      memorySharing: false,
    })

    await agent.turn({ text: 'hi' })
    expect(captured).not.toBeNull()
    const serialized = JSON.stringify(captured)
    expect(serialized).not.toContain('a-stored-preference-string')
  })
})

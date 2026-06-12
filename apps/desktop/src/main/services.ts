import {
  AgentOrchestrator,
  AnthropicProvider,
  AuditLogService,
  ManagedProvider,
  MemoryService,
  MockProvider,
  OpenAIProvider,
  PermissionEngine,
  ProviderSettingsStore,
  ToolRegistry,
  type ModelProvider,
  type ProviderId,
} from '@local-ai-assistant/core'
import {
  BusinessCloudAdapter,
  DesktopObservationAdapter,
  ManualImportAdapter,
  MockEmailConnector,
} from '@local-ai-assistant/connectors'
import { BackgroundWorker } from '@local-ai-assistant/background-worker'
import { getDb, SafeStorageAdapter } from './db.js'

/**
 * Single root-level service registry. The IPC handlers call into this object
 * rather than constructing services on every call. Built once in app `whenReady`.
 */
export interface Services {
  db: ReturnType<typeof getDb>
  encryption: SafeStorageAdapter
  permissions: PermissionEngine
  memory: MemoryService
  audit: AuditLogService
  tools: ToolRegistry
  /** Registry of every provider that exists. The active one is chosen by settings. */
  providerRegistry: Record<ProviderId, ModelProvider>
  /** Single provider the orchestrator talks to — gates approval + local-only. */
  provider: ManagedProvider
  /** AI-provider settings store (selection, approvals, local-only, memory sharing). */
  providerSettings: ProviderSettingsStore
  agent: AgentOrchestrator
  email: { mock: MockEmailConnector }
  whatsapp: {
    business: BusinessCloudAdapter
    manual: ManualImportAdapter
    observation: DesktopObservationAdapter
  }
  worker: BackgroundWorker
}

export function buildServices(): Services {
  const db = getDb()
  const encryption = new SafeStorageAdapter()
  const permissions = new PermissionEngine(db)
  const memory = new MemoryService(db, encryption)
  const audit = new AuditLogService(db)
  const tools = new ToolRegistry()
  const providerSettings = new ProviderSettingsStore(db)

  // API keys come from the environment. The user sets them before launching
  // the app; we do NOT persist them in the SQLite store. If a key is missing,
  // the provider's complete() throws MissingApiKeyError and the UI surfaces it.
  const openaiKey = process.env['OPENAI_API_KEY']
  const anthropicKey = process.env['ANTHROPIC_API_KEY']

  const providerRegistry: Record<ProviderId, ModelProvider> = {
    mock: new MockProvider(),
    openai: new OpenAIProvider({ apiKey: openaiKey }),
    anthropic: new AnthropicProvider({ apiKey: anthropicKey }),
  }

  const provider = new ManagedProvider(providerRegistry, providerSettings, audit)

  const agent = new AgentOrchestrator({
    permissions,
    memory,
    audit,
    tools,
    provider,
    localOnlyMode: () => providerSettings.localOnlyMode(),
    memorySharing: () => providerSettings.memorySharing(),
  })

  const email = { mock: new MockEmailConnector() }
  const whatsapp = {
    business: new BusinessCloudAdapter(),
    manual: new ManualImportAdapter(),
    observation: new DesktopObservationAdapter(),
  }
  const worker = new BackgroundWorker({
    permissions,
    memory,
    audit,
    emailConnectors: [email.mock],
  })

  return {
    db,
    encryption,
    permissions,
    memory,
    audit,
    tools,
    providerRegistry,
    provider,
    providerSettings,
    agent,
    email,
    whatsapp,
    worker,
  }
}

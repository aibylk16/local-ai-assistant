import {
  AgentOrchestrator,
  AuditLogService,
  MemoryService,
  MockProvider,
  PermissionEngine,
  ToolRegistry,
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
  provider: MockProvider
  agent: AgentOrchestrator
  email: { mock: MockEmailConnector }
  whatsapp: {
    business: BusinessCloudAdapter
    manual: ManualImportAdapter
    observation: DesktopObservationAdapter
  }
  worker: BackgroundWorker
  /** Local-only mode flag. UI must surface this when true. */
  localOnlyMode: boolean
}

export function buildServices(): Services {
  const db = getDb()
  const encryption = new SafeStorageAdapter()
  const permissions = new PermissionEngine(db)
  const memory = new MemoryService(db, encryption)
  const audit = new AuditLogService(db)
  const tools = new ToolRegistry()
  const provider = new MockProvider()
  const localOnlyMode = true

  const agent = new AgentOrchestrator({
    permissions,
    memory,
    audit,
    tools,
    provider,
    localOnlyMode,
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
    provider,
    agent,
    email,
    whatsapp,
    worker,
    localOnlyMode,
  }
}

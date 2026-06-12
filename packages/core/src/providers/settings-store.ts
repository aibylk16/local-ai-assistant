import type { DB } from '../db/types.js'
import type { ProviderId } from './types.js'

export interface ProviderSettingsSnapshot {
  selectedProvider: ProviderId
  cloudApproved: Record<ProviderId, boolean>
  /**
   * When true, the managed-provider gate refuses every non-local provider call
   * regardless of approval. Default true; flips to false only when the user
   * explicitly disables it in Settings → AI Provider.
   */
  localOnlyMode: boolean
  /**
   * When false, memory items are never included in the prompt sent to the
   * provider. Default false — must be explicitly opted into.
   */
  memorySharing: boolean
}

const DEFAULTS: Record<string, string> = {
  selected_provider: 'mock',
  'cloud_approved.openai': '0',
  'cloud_approved.anthropic': '0',
  local_only_mode: '1',
  memory_sharing: '0',
}

/**
 * SQLite-backed key/value store for AI-provider settings.
 *
 * Defaults are explicit and conservative:
 *   - selected provider is the offline `mock`
 *   - both cloud providers are NOT approved
 *   - local-only mode is ON
 *   - memory sharing is OFF
 *
 * The {@link ManagedProvider} gate consults this store on every call.
 */
export class ProviderSettingsStore {
  constructor(private readonly db: DB) {
    this.ensureRows()
  }

  private ensureRows(): void {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO provider_settings (key, value, updated_at) VALUES (?, ?, ?)`,
    )
    const ts = new Date().toISOString()
    for (const [k, v] of Object.entries(DEFAULTS)) insert.run(k, v, ts)
  }

  private read(key: string): string {
    const row = this.db
      .prepare(`SELECT value FROM provider_settings WHERE key = ?`)
      .get(key) as { value: string } | undefined
    return row?.value ?? ''
  }

  private write(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO provider_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, new Date().toISOString())
  }

  selectedProvider(): ProviderId {
    const v = this.read('selected_provider')
    return v === 'openai' || v === 'anthropic' ? v : 'mock'
  }

  setSelectedProvider(p: ProviderId): void {
    this.write('selected_provider', p)
  }

  isCloudApproved(p: ProviderId): boolean {
    if (p === 'mock') return true
    return this.read(`cloud_approved.${p}`) === '1'
  }

  approveCloud(p: ProviderId): void {
    if (p === 'mock') return
    this.write(`cloud_approved.${p}`, '1')
  }

  revokeCloud(p: ProviderId): void {
    if (p === 'mock') return
    this.write(`cloud_approved.${p}`, '0')
  }

  localOnlyMode(): boolean {
    return this.read('local_only_mode') === '1'
  }

  setLocalOnlyMode(on: boolean): void {
    this.write('local_only_mode', on ? '1' : '0')
  }

  memorySharing(): boolean {
    return this.read('memory_sharing') === '1'
  }

  setMemorySharing(on: boolean): void {
    this.write('memory_sharing', on ? '1' : '0')
  }

  snapshot(): ProviderSettingsSnapshot {
    return {
      selectedProvider: this.selectedProvider(),
      cloudApproved: {
        mock: true,
        openai: this.isCloudApproved('openai'),
        anthropic: this.isCloudApproved('anthropic'),
      },
      localOnlyMode: this.localOnlyMode(),
      memorySharing: this.memorySharing(),
    }
  }
}

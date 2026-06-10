import type { DB, EncryptionAdapter } from '../db/types.js'
import { looksSensitive, NullEncryptionAdapter } from './encryption.js'

export type MemoryKind = 'preference' | 'contact' | 'workflow' | 'note' | 'pending'

export interface MemoryItem {
  id: number
  createdAt: string
  updatedAt: string
  kind: MemoryKind
  key: string | null
  title: string
  body: string
  source: string | null
  tags: string[]
  reviewed: boolean
  encrypted: boolean
}

export interface MemoryCandidate {
  kind: MemoryKind
  key?: string
  title: string
  body: string
  source?: string
  tags?: string[]
  /** If true, encrypt-at-rest. Defaults to true for kinds that may carry PII. */
  encryptAtRest?: boolean
}

export interface SaveResult {
  saved: MemoryItem | null
  reason?: 'sensitive_blocked'
}

export class MemoryService {
  constructor(
    private readonly db: DB,
    private readonly encryption: EncryptionAdapter = new NullEncryptionAdapter(),
  ) {}

  /**
   * Persist a candidate. Refuses to save if `looksSensitive` matches —
   * the user must manually save sensitive data through `saveManually`.
   *
   * This is the primary entry point for the background worker and the
   * memory-learning permission gate is enforced upstream by the agent.
   */
  saveCandidate(candidate: MemoryCandidate): SaveResult {
    if (looksSensitive(candidate.title + ' ' + candidate.body)) {
      return { saved: null, reason: 'sensitive_blocked' }
    }
    return { saved: this.persist(candidate, false) }
  }

  /**
   * User-initiated save. Bypasses the sensitive-blocker but is explicit.
   * `reviewed` is true because the user pressed save.
   */
  saveManually(candidate: MemoryCandidate): MemoryItem {
    return this.persist(candidate, true)
  }

  private persist(candidate: MemoryCandidate, reviewed: boolean): MemoryItem {
    const ts = new Date().toISOString()
    const encryptAtRest = candidate.encryptAtRest ?? this.encryption.available()
    const body = encryptAtRest ? this.encryption.encrypt(candidate.body) : candidate.body
    const tags = JSON.stringify(candidate.tags ?? [])

    // Upsert on (kind, key) when key provided.
    if (candidate.key) {
      const existing = this.db
        .prepare(`SELECT id FROM memory WHERE kind = ? AND key = ?`)
        .get(candidate.kind, candidate.key) as { id: number } | undefined
      if (existing) {
        this.db
          .prepare(
            `UPDATE memory
             SET updated_at = ?, title = ?, body = ?, body_encrypted = ?,
                 source = ?, tags = ?, reviewed = ?
             WHERE id = ?`,
          )
          .run(
            ts,
            candidate.title,
            body,
            encryptAtRest ? 1 : 0,
            candidate.source ?? null,
            tags,
            reviewed ? 1 : 0,
            existing.id,
          )
        return this.get(existing.id)!
      }
    }

    const r = this.db
      .prepare(
        `INSERT INTO memory (created_at, updated_at, kind, key, title, body, body_encrypted, source, tags, reviewed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ts,
        ts,
        candidate.kind,
        candidate.key ?? null,
        candidate.title,
        body,
        encryptAtRest ? 1 : 0,
        candidate.source ?? null,
        tags,
        reviewed ? 1 : 0,
      )
    return this.get(Number(r.lastInsertRowid))!
  }

  get(id: number): MemoryItem | null {
    const row = this.db
      .prepare(
        `SELECT id, created_at AS createdAt, updated_at AS updatedAt, kind, key, title,
                body, body_encrypted AS bodyEncrypted, source, tags, reviewed
         FROM memory WHERE id = ?`,
      )
      .get(id) as RawRow | undefined
    return row ? this.hydrate(row) : null
  }

  list(opts: { kind?: MemoryKind; limit?: number } = {}): MemoryItem[] {
    const limit = opts.limit ?? 200
    const rows = opts.kind
      ? (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, updated_at AS updatedAt, kind, key, title,
                    body, body_encrypted AS bodyEncrypted, source, tags, reviewed
             FROM memory WHERE kind = ? ORDER BY updated_at DESC LIMIT ?`,
          )
          .all(opts.kind, limit) as RawRow[])
      : (this.db
          .prepare(
            `SELECT id, created_at AS createdAt, updated_at AS updatedAt, kind, key, title,
                    body, body_encrypted AS bodyEncrypted, source, tags, reviewed
             FROM memory ORDER BY updated_at DESC LIMIT ?`,
          )
          .all(limit) as RawRow[])
    return rows.map((r) => this.hydrate(r))
  }

  update(id: number, patch: Partial<Pick<MemoryItem, 'title' | 'body' | 'tags' | 'reviewed'>>): MemoryItem | null {
    const existing = this.get(id)
    if (!existing) return null
    const title = patch.title ?? existing.title
    const tags = JSON.stringify(patch.tags ?? existing.tags)
    const reviewed = (patch.reviewed ?? existing.reviewed) ? 1 : 0
    const newBody = patch.body ?? existing.body
    const body = existing.encrypted ? this.encryption.encrypt(newBody) : newBody
    this.db
      .prepare(
        `UPDATE memory SET updated_at = ?, title = ?, body = ?, tags = ?, reviewed = ? WHERE id = ?`,
      )
      .run(new Date().toISOString(), title, body, tags, reviewed, id)
    return this.get(id)
  }

  delete(id: number): boolean {
    const r = this.db.prepare(`DELETE FROM memory WHERE id = ?`).run(id)
    return r.changes > 0
  }

  deleteAll(): number {
    const r = this.db.prepare(`DELETE FROM memory`).run()
    return r.changes
  }

  /**
   * Export memory as plaintext (decrypted) for the user's "Export all data" button.
   * The UI must remind the user that exported data is no longer encrypted.
   */
  exportAll(): MemoryItem[] {
    return this.list({ limit: 100_000 })
  }

  private hydrate(row: RawRow): MemoryItem {
    const body = row.bodyEncrypted ? this.encryption.decrypt(row.body) : row.body
    let tags: string[] = []
    try {
      tags = row.tags ? (JSON.parse(row.tags) as string[]) : []
    } catch {
      tags = []
    }
    return {
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      kind: row.kind,
      key: row.key,
      title: row.title,
      body,
      source: row.source,
      tags,
      reviewed: row.reviewed === 1,
      encrypted: row.bodyEncrypted === 1,
    }
  }
}

interface RawRow {
  id: number
  createdAt: string
  updatedAt: string
  kind: MemoryKind
  key: string | null
  title: string
  body: string
  bodyEncrypted: number
  source: string | null
  tags: string | null
  reviewed: number
}

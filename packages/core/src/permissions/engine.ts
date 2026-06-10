import type { DB } from '../db/types.js'
import {
  PERMISSION_CATEGORIES,
  PermissionDeniedError,
  type Permission,
  type PermissionCategory,
} from './types.js'
import { DEFAULT_PERMISSIONS } from './defaults.js'

export class PermissionEngine {
  constructor(private readonly db: DB) {
    this.ensureRows()
  }

  private ensureRows(): void {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO permissions (category, granted, granted_at, notes)
       VALUES (?, ?, NULL, NULL)`,
    )
    for (const cat of PERMISSION_CATEGORIES) {
      insert.run(cat, DEFAULT_PERMISSIONS[cat] ? 1 : 0)
    }
  }

  isGranted(cat: PermissionCategory): boolean {
    const row = this.db
      .prepare(`SELECT granted FROM permissions WHERE category = ?`)
      .get(cat) as { granted: number } | undefined
    return !!row && row.granted === 1
  }

  grant(cat: PermissionCategory, notes?: string): void {
    this.db
      .prepare(
        `UPDATE permissions SET granted = 1, granted_at = ?, notes = ? WHERE category = ?`,
      )
      .run(new Date().toISOString(), notes ?? null, cat)
  }

  revoke(cat: PermissionCategory): void {
    this.db
      .prepare(
        `UPDATE permissions SET granted = 0, granted_at = NULL WHERE category = ?`,
      )
      .run(cat)
  }

  all(): Permission[] {
    const rows = this.db
      .prepare(
        `SELECT category, granted, granted_at AS grantedAt, notes FROM permissions`,
      )
      .all() as Array<{
      category: PermissionCategory
      granted: number
      grantedAt: string | null
      notes: string | null
    }>
    return rows.map((r) => ({
      category: r.category,
      granted: r.granted === 1,
      grantedAt: r.grantedAt,
      notes: r.notes,
    }))
  }

  /**
   * Throws PermissionDeniedError if the category is not granted.
   * Every tool execution must call this before doing work.
   */
  require(cat: PermissionCategory): void {
    if (!this.isGranted(cat)) throw new PermissionDeniedError(cat)
  }
}

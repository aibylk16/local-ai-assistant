import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { app, safeStorage } from 'electron'
import { applySchema, type DB, type EncryptionAdapter } from '@local-ai-assistant/core'

let _db: DB | null = null

export function getDb(): DB {
  if (_db) return _db
  const dir = path.join(app.getPath('userData'), 'local-ai-assistant')
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, 'assistant.sqlite')
  const db = new Database(dbPath)
  applySchema(db)
  _db = db
  return db
}

/**
 * Wraps Electron's safeStorage so the core package stays decoupled from
 * Electron. safeStorage uses DPAPI on Windows and Keychain on macOS.
 *
 * If safeStorage is not available (rare; some Linux headless environments),
 * encryption falls back to a no-op and the UI must warn the user.
 */
export class SafeStorageAdapter implements EncryptionAdapter {
  available(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
  encrypt(plaintext: string): string {
    if (!this.available()) return plaintext
    return safeStorage.encryptString(plaintext).toString('base64')
  }
  decrypt(ciphertext: string): string {
    if (!this.available()) return ciphertext
    try {
      return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
    } catch {
      return ciphertext
    }
  }
}

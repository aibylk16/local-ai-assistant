import type Database from 'better-sqlite3'

export type DB = Database.Database

export interface EncryptionAdapter {
  available(): boolean
  encrypt(plaintext: string): string
  decrypt(ciphertext: string): string
}

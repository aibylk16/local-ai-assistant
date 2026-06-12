import type { EncryptionAdapter } from '../db/types.js'

/**
 * NullEncryptionAdapter is a passthrough for tests and dev. Real Electron
 * usage wires in safeStorage from the main process which is backed by
 * DPAPI on Windows and Keychain on macOS.
 */
export class NullEncryptionAdapter implements EncryptionAdapter {
  available(): boolean {
    return false
  }
  encrypt(plaintext: string): string {
    return plaintext
  }
  decrypt(ciphertext: string): string {
    return ciphertext
  }
}

/**
 * Heuristic for what we should never auto-store in memory, no matter
 * how the data arrived. The memory service consults this BEFORE persisting
 * any candidate from the background worker.
 */
const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:\d[ -]*?){13,19}\b/, // payment card-shaped
  /\b\d{3,4}\b\s*(?:cvv|cvc)\b/i,
  /\bpassword\b\s*[:=]/i,
  /\bpin\b\s*[:=]\s*\d{3,8}\b/i,
  /\b(?:otp|one[- ]?time[- ]?password)\b/i,
  /\b(?:aadhaar|aadhar|ssn|pan card)\b/i,
  /\bsk-[a-z0-9]{20,}\b/i, // OpenAI-style secret key
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, // JWT
]

export function looksSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(text))
}

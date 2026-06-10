export const PERMISSION_CATEGORIES = [
  'microphone',
  'speaker',
  'file.read',
  'file.write',
  'browser.automation',
  'email.read',
  'email.draft',
  'email.send',
  'whatsapp.read',
  'whatsapp.draft',
  'whatsapp.send',
  'screen.observe',
  'accessibility',
  'background.monitoring',
  'memory.learning',
] as const

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number]

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Permission {
  category: PermissionCategory
  granted: boolean
  grantedAt: string | null
  notes: string | null
}

export class PermissionDeniedError extends Error {
  constructor(public readonly category: PermissionCategory) {
    super(`Permission denied: ${category}`)
    this.name = 'PermissionDeniedError'
  }
}

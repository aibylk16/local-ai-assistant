import type { PermissionCategory, RiskLevel } from './types.js'

/**
 * All powerful permissions are OFF by default. The setup wizard or
 * Permission Center is the only place these flip to true.
 */
export const DEFAULT_PERMISSIONS: Record<PermissionCategory, boolean> = {
  microphone: false,
  speaker: false,
  'file.read': false,
  'file.write': false,
  'browser.automation': false,
  'email.read': false,
  'email.draft': false,
  'email.send': false,
  'whatsapp.read': false,
  'whatsapp.draft': false,
  'whatsapp.send': false,
  'screen.observe': false,
  accessibility: false,
  'background.monitoring': false,
  'memory.learning': false,
}

/**
 * Mapping a permission category to the risk level of acting under it.
 * The agent uses this to decide whether to require a confirmation modal.
 */
export const PERMISSION_RISK: Record<PermissionCategory, RiskLevel> = {
  microphone: 'low',
  speaker: 'low',
  'file.read': 'low',
  'file.write': 'medium',
  'browser.automation': 'medium',
  'email.read': 'low',
  'email.draft': 'low',
  'email.send': 'high',
  'whatsapp.read': 'low',
  'whatsapp.draft': 'low',
  'whatsapp.send': 'high',
  'screen.observe': 'high',
  accessibility: 'high',
  'background.monitoring': 'medium',
  'memory.learning': 'low',
}

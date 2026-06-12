import type { NameCheckResult } from './types.js'

export const MAX_ASSISTANT_NAME_LENGTH = 40

/**
 * Names that collide with other voice ecosystems. Choosing one would make this
 * assistant trigger (or be triggered by) other devices in the same room.
 */
export const ECOSYSTEM_NAMES = ['alexa', 'siri', 'google', 'cortana', 'bixby', 'echo']

/**
 * Names too generic for an office — spoken constantly in normal conversation,
 * so they would cause false wakes once wake mode exists.
 */
export const GENERIC_NAMES = ['computer', 'assistant', 'ai', 'hey']

/** True when the string contains ASCII control characters (codes 0-31 or 127). */
function hasControlChars(s: string): boolean {
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 32 || code === 127) return true
  }
  return false
}

/**
 * Validate a proposed assistant name and flag risky common names.
 *
 * Rationale (docs/assistant-identity.md): in an office where many assistants
 * coexist, a shared or ecosystem-colliding wake name means one spoken command
 * activates many devices. The warning does not block the choice — the user may
 * proceed — but the store records the overridden warning in the audit log.
 */
export function checkAssistantName(name: string): NameCheckResult {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Assistant name cannot be empty.' }
  }
  if (trimmed.length > MAX_ASSISTANT_NAME_LENGTH) {
    return {
      valid: false,
      reason: `Assistant name must be ${MAX_ASSISTANT_NAME_LENGTH} characters or fewer.`,
    }
  }
  if (hasControlChars(trimmed)) {
    return { valid: false, reason: 'Assistant name contains control characters.' }
  }

  const lower = trimmed.toLowerCase()
  if (ECOSYSTEM_NAMES.includes(lower)) {
    return {
      valid: true,
      warning:
        `"${trimmed}" is used by another voice assistant ecosystem. ` +
        'Saying it aloud may trigger other devices in the same room (and vice versa). ' +
        'Choose a unique name for office use.',
    }
  }
  if (GENERIC_NAMES.includes(lower)) {
    return {
      valid: true,
      warning:
        `"${trimmed}" is a very common word. It will be spoken in normal conversation ` +
        'and would cause false wake-ups once wake mode exists. Choose a more distinctive name.',
    }
  }
  return { valid: true }
}

/** Wake phrase derived from the configured name: "Hey <name>". */
export function wakePhraseFor(assistantName: string): string {
  const trimmed = assistantName.trim()
  return trimmed.length === 0 ? '' : `Hey ${trimmed}`
}

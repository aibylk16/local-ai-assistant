/**
 * Assistant identity settings — local-only data model (roadmap Phase 2).
 *
 * There is NO fixed global assistant name. Each user/company chooses a name at
 * setup; the wake phrase derives from it ("Hey <name>"). When wake mode is
 * eventually implemented (roadmap Phase 9), the assistant must respond only to
 * its configured wake phrase and ignore everything else.
 *
 * This module is a data model + store only. It does not implement any wake
 * mode, microphone access, or always-listening behavior.
 */

export type VoiceStyle = 'female' | 'male' | 'neutral'

export interface AssistantIdentity {
  /**
   * False until first-run setup stores a name. While unconfigured, the UI
   * should route to the setup wizard rather than inventing a default name.
   */
  configured: boolean
  /** User/company-chosen name, e.g. "Tara", "Nova", "Riva". Empty until configured. */
  assistantName: string
  /** Derived: `Hey <assistantName>`. Empty until configured. */
  wakePhrase: string
  /** Used for TTS voice selection (when TTS exists) and tone labels. */
  voiceStyle: VoiceStyle
  /** Optional, e.g. "Acme Pvt Ltd" — shown in UI, useful for multi-office setups. */
  companyLabel?: string
}

export interface AssistantIdentityInput {
  assistantName: string
  voiceStyle: VoiceStyle
  companyLabel?: string
}

export interface NameCheckResult {
  /** False when the name is unusable (empty, too long, control characters). */
  valid: boolean
  /** Why the name is invalid; set only when `valid` is false. */
  reason?: string
  /**
   * Set when the name is valid but risky (collides with other voice ecosystems
   * or is too generic for an office). The UI must show this before accepting,
   * and an overridden warning is recorded in the audit log.
   */
  warning?: string
}

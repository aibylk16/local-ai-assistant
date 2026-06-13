/**
 * User-facing copy for the trainable brain.
 *
 * The whole point of the brain layer is that it feels like a normal assistant.
 * When the assistant silently reuses learned knowledge in chat, it must NOT
 * expose the internal mechanics. The user hears "I'll use your usual format",
 * never "a template matched" or "replay started".
 *
 * These two lists are the contract:
 * - {@link TRAINED_REUSE_COPY} / {@link TRAINING_UI_TERMS} are the words users see.
 * - {@link INTERNAL_ONLY_TERMS} are words allowed ONLY in developer docs and the
 *   admin/backend settings - never in normal chat or normal UI.
 *
 * A test asserts the user-facing copy contains none of the internal terms, so a
 * regression that leaks "workflow"/"template"/"replay" into chat fails CI.
 */

/** Natural phrases the assistant uses when it silently reuses learned knowledge. */
export const TRAINED_REUSE_COPY = {
  canDo: 'I can do that.',
  usualFormat: "I'll use your usual format.",
  preparedYourWay: "I'll prepare the report the way you showed me.",
  confirmBeforeSend: 'Before I send this, please confirm.',
  askOpenApp: (appLabel: string) => `Please allow me to open ${appLabel}.`,
} as const

/** Labels the normal (non-developer) Training UI is allowed to use. */
export const TRAINING_UI_TERMS = {
  trainAssistant: 'Train assistant',
  teachTask: 'Teach a task',
  learnedThis: 'My assistant learned this',
  useStyleNextTime: 'Use this style next time',
  saveMyWay: 'Save as my way of doing this',
  companyLearning: 'Company learning',
  personalLearning: 'Personal learning',
} as const

/**
 * Internal/mechanical terms that must never appear in normal chat or normal UI.
 * They are allowed only in developer docs and admin/backend settings.
 */
export const INTERNAL_ONLY_TERMS: readonly string[] = [
  'workflow',
  'template',
  'matcher',
  'replay',
  'vector',
  'model weights',
  'fine-tune',
  'fine tune',
  'fine-tuning',
]

/**
 * Returns the internal terms found in a user-facing string (case-insensitive).
 * Empty means the copy is safe to show a normal user.
 */
export function internalTermsIn(text: string): string[] {
  const lower = text.toLowerCase()
  return INTERNAL_ONLY_TERMS.filter((term) => lower.includes(term))
}

/** Convenience: all the user-facing strings the brain ships, for testing. */
export function allUserFacingCopy(): string[] {
  return [
    TRAINED_REUSE_COPY.canDo,
    TRAINED_REUSE_COPY.usualFormat,
    TRAINED_REUSE_COPY.preparedYourWay,
    TRAINED_REUSE_COPY.confirmBeforeSend,
    TRAINED_REUSE_COPY.askOpenApp('Gmail'),
    ...Object.values(TRAINING_UI_TERMS),
  ]
}

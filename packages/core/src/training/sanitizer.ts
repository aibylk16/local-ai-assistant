import { looksSensitive } from '../memory/encryption.js'
import type { LearnedLessonInput, SeedSensitiveIssue, TaskSeed } from './types.js'

/**
 * Backend/admin training is stricter than user teaching. A user teaching a task
 * may type a real email address by accident, and the workflow sanitizer REDACTS
 * it. A backend seed file, by contrast, must be generic by construction: if it
 * contains anything that looks like private data we REFUSE it outright rather
 * than quietly redacting, because a developer should fix the seed, not ship a
 * half-redacted one.
 *
 * These patterns therefore intentionally over-trigger. Over-triggering blocks a
 * seed (developer rewrites it generically); it can never leak data.
 */
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/
const LONG_ID_RE = /\b\d{6,}\b/ // order/invoice IDs, account numbers, long codes
const URL_SECRET_RE = /[?&](?:token|key|secret|password|session|auth)=[^&\s]+/i
const MONEY_RE = /(?:rs\.?|inr|usd|eur|gbp|\$)\s?\d[\d,]*(?:\.\d+)?/i

const FIELD_CHECKS: ReadonlyArray<{ re: RegExp; reason: string }> = [
  { re: EMAIL_RE, reason: 'looks like an email address' },
  { re: PHONE_RE, reason: 'looks like a phone number' },
  { re: LONG_ID_RE, reason: 'looks like an order/invoice/account number' },
  { re: URL_SECRET_RE, reason: 'contains a secret URL parameter' },
  { re: MONEY_RE, reason: 'contains an exact money amount' },
]

function issuesForText(field: string, text: string | undefined): SeedSensitiveIssue[] {
  if (!text) return []
  const issues: SeedSensitiveIssue[] = []
  if (looksSensitive(text)) {
    issues.push({ field, reason: 'matches a credential/OTP/card/key pattern' })
  }
  for (const { re, reason } of FIELD_CHECKS) {
    if (re.test(text)) issues.push({ field, reason })
  }
  return issues
}

/**
 * Returns every reason a seed looks like it carries private data. Empty means
 * the seed is generic and safe to import. The importer refuses any seed with at
 * least one issue.
 */
export function findSeedSensitiveIssues(seed: TaskSeed): SeedSensitiveIssue[] {
  const issues: SeedSensitiveIssue[] = []
  issues.push(...issuesForText('goal', seed.goal))
  seed.triggerPhrases.forEach((p, i) => issues.push(...issuesForText(`triggerPhrases[${i}]`, p)))
  seed.tags.forEach((t, i) => issues.push(...issuesForText(`tags[${i}]`, t)))
  seed.apps.forEach((a, i) => issues.push(...issuesForText(`apps[${i}]`, a)))
  seed.steps.forEach((s, i) => {
    issues.push(...issuesForText(`steps[${i}].instruction`, s.instruction))
    issues.push(...issuesForText(`steps[${i}].target`, s.target))
    issues.push(...issuesForText(`steps[${i}].selectorHint`, s.selectorHint))
  })
  return issues
}

/** Same strict check for a channel-C lesson before it is stored. */
export function findLessonSensitiveIssues(input: LearnedLessonInput): SeedSensitiveIssue[] {
  const issues: SeedSensitiveIssue[] = []
  issues.push(...issuesForText('summary', input.summary))
  issues.push(...issuesForText('detail', input.detail))
  ;(input.tags ?? []).forEach((t, i) => issues.push(...issuesForText(`tags[${i}]`, t)))
  return issues
}

/** A seed is structurally valid if it has a goal, at least one trigger, and steps. */
export function seedStructureIssues(seed: TaskSeed): string[] {
  const issues: string[] = []
  if (!seed.goal?.trim()) issues.push('goal is empty')
  if (!seed.triggerPhrases?.some((p) => p.trim())) issues.push('no trigger phrases')
  if (!seed.steps?.length) issues.push('no steps')
  return issues
}

import { sanitizeWorkflowText } from '../workflows/sanitizer.js'
import type { WorkflowTemplate } from '../workflows/types.js'
import { findLessonSensitiveIssues } from './sanitizer.js'
import type { FineTuningRecord, LearnedLesson } from './types.js'

/**
 * Channel D - prepare a sanitized dataset for a FUTURE, opt-in fine-tuning of an
 * open-source/local model.
 *
 * HONESTY NOTE: this function does NOT train, fine-tune, or call any model. It
 * only converts already-sanitized brain knowledge (workflow templates, lessons)
 * into generic instruction/response records and re-runs the sensitivity check as
 * a last line of defense. Whether to ever train on these records is a separate,
 * explicit decision that does not happen in this pass.
 *
 * By default only shared (team/global) knowledge is exported, because that is
 * the knowledge already approved as generic. Private knowledge is excluded
 * unless the caller opts in - and even then each record is re-sanitized and
 * dropped if anything still looks sensitive.
 */
export function exportFineTuningRecords(input: {
  templates?: WorkflowTemplate[]
  lessons?: LearnedLesson[]
  includePrivate?: boolean
}): FineTuningRecord[] {
  const includePrivate = input.includePrivate === true
  const records: FineTuningRecord[] = []

  for (const t of input.templates ?? []) {
    if (!t.approvedForReuse) continue
    if (t.scope === 'private' && !includePrivate) continue
    const instruction = sanitizeWorkflowText(t.triggerPhrases[0] ?? t.name)
    const context = sanitizeWorkflowText(
      [`Task: ${t.name}`, t.apps.length ? `Apps: ${t.apps.join(', ')}` : '']
        .filter(Boolean)
        .join('. '),
    )
    const response = sanitizeWorkflowText(
      t.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join(' '),
    )
    const record: FineTuningRecord = {
      instruction,
      context,
      response,
      tags: t.tags,
      scope: t.scope,
      source: 'seed_or_workflow',
    }
    if (isCleanRecord(record)) records.push(record)
  }

  for (const l of input.lessons ?? []) {
    if (l.scope === 'private' && !includePrivate) continue
    // Re-check the lesson with the strict detector; skip anything unsafe.
    if (
      findLessonSensitiveIssues({ kind: l.kind, summary: l.summary, detail: l.detail ?? undefined, scope: l.scope, tags: l.tags })
        .length > 0
    ) {
      continue
    }
    const record: FineTuningRecord = {
      instruction: sanitizeWorkflowText(`Apply the preferred ${humanizeKind(l.kind)}.`),
      context: sanitizeWorkflowText(`Preference type: ${l.kind}.`),
      response: sanitizeWorkflowText([l.summary, l.detail].filter(Boolean).join(' ')),
      tags: l.tags,
      scope: l.scope,
      source: 'lesson',
    }
    if (isCleanRecord(record)) records.push(record)
  }

  return records
}

function isCleanRecord(record: FineTuningRecord): boolean {
  // Reuse the lesson detector over the combined text as a final guard.
  return (
    findLessonSensitiveIssues({
      kind: 'output_format',
      summary: [record.instruction, record.context, record.response].join(' '),
      scope: record.scope,
      tags: record.tags,
    }).length === 0
  )
}

function humanizeKind(kind: LearnedLesson['kind']): string {
  switch (kind) {
    case 'output_format':
      return 'output format'
    case 'step_order':
      return 'step order'
    case 'confirmation_preference':
      return 'confirmation preference'
    case 'app_preference':
      return 'app preference'
    case 'classification_rule':
      return 'classification rule'
    default:
      return 'preference'
  }
}

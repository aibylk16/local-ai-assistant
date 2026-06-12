import { looksSensitive } from '../memory/encryption.js'
import type { WorkflowStep, WorkflowStepInput, WorkflowTemplateInput } from './types.js'

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g
const URL_QUERY_RE = /([?&](?:token|key|secret|password|session|auth)=)[^&\s]+/gi
const LONG_NUMBER_RE = /\b\d{8,}\b/g

export function sanitizeWorkflowText(text: string): string {
  return text
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(URL_QUERY_RE, '$1[redacted]')
    .replace(LONG_NUMBER_RE, '[number]')
    .trim()
}

export function sanitizeWorkflowStep(step: WorkflowStepInput): WorkflowStep {
  return {
    kind: step.kind,
    instruction: sanitizeWorkflowText(step.instruction),
    app: step.app ? sanitizeWorkflowText(step.app) : undefined,
    target: step.target ? sanitizeWorkflowText(step.target) : undefined,
    selectorHint: step.selectorHint ? sanitizeWorkflowText(step.selectorHint) : undefined,
    dataPolicy: step.dataPolicy ?? inferDataPolicy(step),
  }
}

export function workflowLooksSensitive(input: WorkflowTemplateInput): boolean {
  const text = [
    input.name,
    input.description,
    input.sourceDetail,
    ...input.triggerPhrases,
    ...input.steps.flatMap((s) => [s.instruction, s.app, s.target, s.selectorHint]),
  ]
    .filter(Boolean)
    .join(' ')
  return looksSensitive(text)
}

function inferDataPolicy(step: WorkflowStepInput): WorkflowStep['dataPolicy'] {
  if (step.kind === 'draft_message' || step.kind === 'type') {
    return 'requires_final_confirmation'
  }
  if (step.kind === 'observe' || step.kind === 'read_table' || step.kind === 'download') {
    return 'uses_current_user_data'
  }
  return 'no_user_data'
}

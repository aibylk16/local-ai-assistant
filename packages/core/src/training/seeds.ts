import type { TaskSeed } from './types.js'

/**
 * Built-in, GENERIC office-task seeds a developer/admin can import to give a
 * fresh install useful starting skills. Every seed here is deliberately free of
 * any real user's data - it describes the SHAPE of a common task only.
 *
 * Defaults are conservative:
 * - 'team'/'global' seeds ship with `approvedByUser: false` so importing them
 *   is a deliberate, audited act, not an accident. Flip the flag (or pass an
 *   approval at import time) only after you have reviewed the seed.
 * - Any step that sends/posts/deletes/uploads/submits/pays is marked so the
 *   sanitizer forces final confirmation; `finalConfirmation` here is advisory.
 *
 * To add a new skill, append a TaskSeed and keep it generic. See
 * docs/developer-training.md.
 */
export const OFFICE_TASK_SEEDS: readonly TaskSeed[] = [
  {
    goal: 'check unread emails that need reply',
    triggerPhrases: [
      'check my unread emails',
      'which emails need a reply',
      'any emails i need to answer',
    ],
    apps: ['gmail'],
    steps: [
      {
        kind: 'open_app',
        app: 'gmail',
        instruction: 'Open the email inbox.',
      },
      {
        kind: 'observe',
        app: 'gmail',
        instruction: 'Read the unread message list and note sender and subject only.',
      },
      {
        kind: 'custom',
        instruction:
          'Classify which messages look like they need a reply (a question, a request, or a pending action) versus newsletters and notifications.',
      },
      {
        kind: 'custom',
        instruction: 'Summarize the ones that need a reply as a short list for the user.',
      },
    ],
    requiredPermissions: ['email.read'],
    finalConfirmation: false,
    scope: 'team',
    approvedByUser: false,
    tags: ['email', 'triage', 'inbox'],
  },
  {
    goal: 'draft a polite reply to a pending message',
    triggerPhrases: [
      'draft a polite reply',
      'write a reply to this message',
      'help me respond politely',
    ],
    apps: ['whatsapp'],
    steps: [
      {
        kind: 'observe',
        app: 'whatsapp',
        instruction: 'Look at the pending conversation to understand what is being asked.',
      },
      {
        kind: 'custom',
        instruction: 'Decide a short, polite, professional tone for the reply.',
      },
      {
        kind: 'draft_message',
        app: 'whatsapp',
        instruction: 'Draft a polite reply for the user to review. Do not send it.',
      },
    ],
    requiredPermissions: ['whatsapp.read', 'whatsapp.draft'],
    finalConfirmation: true,
    scope: 'team',
    approvedByUser: false,
    tags: ['whatsapp', 'reply', 'drafting'],
  },
  {
    goal: 'download the sales report and create an Excel summary',
    triggerPhrases: [
      'download the sales report and summarize it',
      'make an excel summary of the sales report',
      'pull the sales report into a summary',
    ],
    apps: ['browser', 'excel'],
    steps: [
      {
        kind: 'open_url',
        app: 'browser',
        instruction: 'Open the seller/reports page.',
      },
      {
        kind: 'download',
        app: 'browser',
        instruction: 'Download the requested report file.',
      },
      {
        kind: 'read_table',
        app: 'excel',
        instruction: 'Open the downloaded report and read the table.',
      },
      {
        kind: 'transform_table',
        app: 'excel',
        instruction:
          'Build a summary sheet: group by period, add totals, and a short headline of key numbers.',
      },
      {
        kind: 'create_file',
        app: 'excel',
        instruction: 'Save the summary workbook for the user to review.',
      },
    ],
    requiredPermissions: ['browser.automation', 'file.read', 'file.write'],
    finalConfirmation: false,
    scope: 'team',
    approvedByUser: false,
    tags: ['report', 'excel', 'analysis'],
  },
  {
    goal: 'open a website after the user approves',
    triggerPhrases: ['open a website', 'go to a site', 'open this page'],
    apps: ['browser'],
    steps: [
      {
        kind: 'ask_confirmation',
        instruction: 'Ask the user which site to open and confirm it is allowed.',
      },
      {
        kind: 'open_url',
        app: 'browser',
        instruction: 'Open the approved website in the browser.',
      },
    ],
    requiredPermissions: ['browser.automation'],
    finalConfirmation: false,
    scope: 'global',
    approvedByUser: false,
    tags: ['browser', 'navigation'],
  },
  {
    goal: 'organize downloaded invoices by month',
    triggerPhrases: [
      'organize my invoices by month',
      'sort the downloaded invoices into folders',
      'file the invoices by month',
    ],
    apps: ['explorer'],
    steps: [
      {
        kind: 'observe',
        app: 'explorer',
        instruction: 'List the invoice files in the downloads folder.',
      },
      {
        kind: 'custom',
        instruction: 'Determine each file month from its date, not from its contents.',
      },
      {
        kind: 'create_file',
        app: 'explorer',
        instruction: 'Create a folder per month if it does not exist.',
      },
      {
        kind: 'custom',
        instruction: 'Move each invoice into its month folder.',
      },
    ],
    requiredPermissions: ['file.read', 'file.write'],
    finalConfirmation: false,
    scope: 'team',
    approvedByUser: false,
    tags: ['files', 'invoices', 'organization'],
  },
]

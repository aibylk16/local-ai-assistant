export type WorkflowScope = 'private' | 'team' | 'global'

export type WorkflowStepKind =
  | 'open_app'
  | 'open_url'
  | 'observe'
  | 'click'
  | 'type'
  | 'download'
  | 'read_table'
  | 'transform_table'
  | 'create_file'
  | 'draft_message'
  | 'ask_confirmation'
  | 'custom'

export interface WorkflowStepInput {
  kind: WorkflowStepKind
  instruction: string
  app?: string
  target?: string
  selectorHint?: string
  dataPolicy?: 'no_user_data' | 'uses_current_user_data' | 'requires_final_confirmation'
}

export interface WorkflowStep extends WorkflowStepInput {
  dataPolicy: 'no_user_data' | 'uses_current_user_data' | 'requires_final_confirmation'
}

export interface WorkflowTemplateInput {
  name: string
  description: string
  scope: WorkflowScope
  triggerPhrases: string[]
  steps: WorkflowStepInput[]
  apps?: string[]
  tags?: string[]
  requiresApproval?: boolean
  approvedForReuse?: boolean
  sourceUserId?: string | null
  sourceDetail?: string | null
}

export interface WorkflowTemplate {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  description: string
  scope: WorkflowScope
  triggerPhrases: string[]
  steps: WorkflowStep[]
  apps: string[]
  tags: string[]
  requiresApproval: boolean
  approvedForReuse: boolean
  sourceUserId: string | null
  sourceDetail: string | null
}

export interface WorkflowMatch {
  template: WorkflowTemplate
  score: number
  matchedPhrase: string | null
}

export interface WorkflowSaveResult {
  saved: WorkflowTemplate | null
  reason?: 'sensitive_blocked' | 'shared_scope_requires_approval'
}

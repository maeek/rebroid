import type { AutomationCommandOutput, AutomationDefinition, AutomationTag } from '@rebroid/automation-core/definition'
import type { AutomationCommandEditorMetadata } from '@rebroid/automation-core/command-registry'

export type AutomationLastStatus = 'never_run' | 'success' | 'failed' | 'running'
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule' | 'webhook' | 'event'
export type AutomationTriggerType = 'schedule' | 'webhook' | 'event'
export type AutomationStartPolicy = 'require-running' | 'start-if-needed'

export interface Automation {
  id: string
  ownerUserId: string
  name: string
  description: string | null
  tags: AutomationTag[]
  definition: AutomationDefinition
  yaml: string
  lastRunAt: string | null
  lastStatus: AutomationLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type AutomationsGridSortField = 'name' | 'lastRunAt' | 'lastStatus' | 'createdAt' | 'updatedAt'
export type AutomationsGridLastRunFilter = 'all' | 'never' | '7d' | '30d' | '90d'

export interface AutomationsGridQuery {
  page?: number
  pageSize?: number
  q?: string
  tag?: string
  targetApplicationId?: string
  status?: AutomationLastStatus
  lastRun?: AutomationsGridLastRunFilter
  sort?: string
}

export interface AutomationsGridPage {
  items: Automation[]
  total: number
  page: number
  pageSize: number
  facets: {
    tags: string[]
    targetApplicationIds: string[]
  }
}

export interface AutomationTriggersGridQuery {
  page?: number
  pageSize?: number
  q?: string
  tag?: string
  targetApplicationId?: string
  enabled?: 'true' | 'false'
  status?: AutomationLastStatus
  lastRun?: AutomationsGridLastRunFilter
  sort?: string
}

export interface AutomationTriggersGridPage {
  items: AutomationTrigger[]
  total: number
  page: number
  pageSize: number
  facets: {
    tags: string[]
    targetApplicationIds: string[]
  }
}

export interface AutomationCommand {
  uses: string
  label: string
  description: string
  requiredPermissions: string[]
  inputSchema: Record<string, unknown>
  outputs: AutomationCommandOutput[]
  editor: AutomationCommandEditorMetadata
}

export interface AutomationStepResult {
  stepId: string
  uses: string
  parentStepId?: string | null
  path?: string
  status: 'success' | 'failed' | 'skipped'
  startedAt: string
  completedAt: string
  output: Record<string, unknown> | null
  error: string | null
}

export interface AutomationRun {
  id: string
  automationId: string
  automationTriggerId: string | null
  ownerUserId: string
  targetApplicationId: string
  targetProfileMode: string | null
  targetProfileName: string | null
  trigger: AutomationRunTrigger
  status: AutomationRunStatus
  startedAt: string | null
  completedAt: string | null
  stepResults: AutomationStepResult[]
  error: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAutomationInput {
  yaml: string
}

export interface RunAutomationInput {
  targetApplicationId: string
  profileMode?: string | null
  profileName?: string | null
  startPolicy?: AutomationStartPolicy
}

export interface RunAdHocAiAutomationInput extends RunAutomationInput {
  prompt: string
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
  clientMessageId?: string
  allowedTools?: string[]
  maxToolCalls?: number
  timeoutMs?: number
}

export interface DraftAutomationYamlInput {
  prompt: string
  providerId?: string
  modelId?: string
  visionProviderId?: string
  visionModelId?: string
}

export interface AutomationYamlDraft {
  yaml: string
  definition: AutomationDefinition
}

export type AutomationRunEventType =
  | 'run.queued'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.canceled'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.progress'
  | 'ai.model.started'
  | 'ai.model.completed'
  | 'ai.perception.observed'
  | 'ai.perception.summary'
  | 'ai.user.message'
  | 'ai.screenshot.observed'
  | 'ai.ui.observed'
  | 'ai.message.delta'
  | 'ai.message.completed'
  | 'ai.tool.started'
  | 'ai.tool.arguments'
  | 'ai.tool.completed'
  | 'ai.tool.failed'
  | 'ai.guardrail.triggered'
  | 'heartbeat'

export interface AutomationRunEvent {
  id: string
  runId: string
  ownerUserId: string
  sequence: number
  type: AutomationRunEventType
  stepId: string | null
  parentStepId: string | null
  message: string
  data: Record<string, unknown>
  createdAt: string
}

export interface AutomationRunEventStreamToken {
  token: string
  expiresAt: string
}

export interface AutomationTrigger {
  id: string
  ownerUserId: string
  name: string
  automationId: string
  targetApplicationId: string
  profileMode: string | null
  profileName: string | null
  enabled: boolean
  tags: AutomationTag[]
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: AutomationLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveAutomationTriggerInput {
  name: string
  automationId: string
  targetApplicationId: string
  profileMode?: string | null
  profileName?: string | null
  enabled?: boolean
  tags?: AutomationTag[]
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
}

export interface AutomationValidation {
  valid: boolean
  definition: AutomationDefinition | null
  yaml: string | null
  errors: string[]
}

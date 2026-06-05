export type AutomationLastStatus = 'never_run' | 'success' | 'failed' | 'running'
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule' | 'webhook' | 'event'
export type AutomationTriggerType = 'schedule' | 'webhook' | 'event'
export type AutomationStartPolicy = 'require-running' | 'start-if-needed'

export type AutomationValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'unknown'

export interface AutomationTag {
  name: string
  color: string
}

export interface AutomationCommandOutput {
  key: string
  label: string
  type: AutomationValueType
  description: string
  example?: unknown
}

export type AutomationConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'doesNotContain'
  | 'exists'
  | 'doesNotExist'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isTrue'
  | 'isFalse'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'matches'
  | 'lengthEquals'
  | 'lengthGreaterThan'
  | 'lengthLessThan'

export type AutomationValueRef =
  | { source: 'literal'; value?: unknown }
  | { source: 'runContext'; key: string }
  | { source: 'stepOutput'; stepId: string; outputKey: string }

export interface AutomationConditionRule {
  value: AutomationValueRef
  operator: AutomationConditionOperator
  compare?: AutomationValueRef
}

export interface AutomationConditionGroup {
  conditions: AutomationConditionRule[]
}

export interface AutomationConditionExpression {
  groups: AutomationConditionGroup[]
}

export interface AutomationActionStep {
  id: string
  uses: string
  with: Record<string, unknown>
}

export interface AutomationConditionStep {
  id: string
  type: 'condition'
  condition: AutomationConditionExpression
  then: AutomationDefinitionStep[]
  else?: AutomationDefinitionStep[]
}

export interface AutomationSwitchCase {
  value: unknown
  steps: AutomationDefinitionStep[]
}

export interface AutomationSwitchStep {
  id: string
  type: 'switch'
  value: AutomationValueRef
  cases: AutomationSwitchCase[]
  default?: AutomationDefinitionStep[]
}

export interface AutomationRepeatStep {
  id: string
  type: 'repeat'
  count?: number
  while?: AutomationConditionExpression
  maxIterations: number
  steps: AutomationDefinitionStep[]
}

export type AutomationDefinitionStep =
  | AutomationActionStep
  | AutomationConditionStep
  | AutomationSwitchStep
  | AutomationRepeatStep

export interface AutomationDefinition {
  apiVersion: 'rebroid.io/automation/v1'
  kind: 'AndroidAutomation'
  metadata: {
    name: string
    description?: string
    tags?: AutomationTag[]
  }
  spec: {
    steps: AutomationDefinitionStep[]
  }
}

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

export interface AutomationCommandEditorExample {
  label: string
  input: Record<string, unknown>
}

export interface AutomationCommandEditorMetadata {
  inputDefaults: Record<string, unknown>
  inputFieldOrder: string[]
  yamlSnippetFields: string[]
  category?: string
  iconKey?: string
  examples?: AutomationCommandEditorExample[]
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
  providerId?: string
  modelId?: string
  allowedTools?: string[]
  maxToolCalls?: number
  timeoutMs?: number
}

export interface DraftAutomationYamlInput {
  prompt: string
  providerId?: string
  modelId?: string
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

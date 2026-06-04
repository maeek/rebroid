export type AutomationLastStatus = 'never_run' | 'success' | 'failed' | 'running'
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule' | 'webhook' | 'event'
export type AutomationTriggerType = 'schedule' | 'webhook' | 'event'
export type AutomationStartPolicy = 'require-running' | 'start-if-needed'

export interface AutomationDefinitionStep {
  id: string
  uses: string
  with: Record<string, unknown>
}

export interface AutomationDefinition {
  apiVersion: 'rebroid.io/automation/v1'
  kind: 'AndroidAutomation'
  metadata: {
    name: string
    description?: string
    labels?: Record<string, string>
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
  definition: AutomationDefinition
  yaml: string
  lastRunAt: string | null
  lastStatus: AutomationLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface AutomationCommand {
  uses: string
  label: string
  description: string
  requiredPermissions: string[]
}

export interface AutomationStepResult {
  stepId: string
  uses: string
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

export interface AutomationTrigger {
  id: string
  ownerUserId: string
  name: string
  automationId: string
  targetApplicationId: string
  profileMode: string | null
  profileName: string | null
  enabled: boolean
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
  triggerType: AutomationTriggerType
  triggerConfig: Record<string, unknown>
}

export interface AutomationValidation {
  valid: boolean
  definition: AutomationDefinition | null
  yaml: string | null
  errors: string[]
}

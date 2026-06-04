export type AutomationLastStatus = 'never_run' | 'success' | 'failed' | 'running'
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule'

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
  scheduleEnabled: boolean
  cronExpression: string | null
  targetApplicationId: string | null
  lastRunAt: string | null
  nextRunAt: string | null
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
  ownerUserId: string
  targetApplicationId: string
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
  scheduleEnabled?: boolean
  cronExpression?: string | null
  targetApplicationId?: string | null
}

export interface AutomationValidation {
  valid: boolean
  definition: AutomationDefinition | null
  yaml: string | null
  errors: string[]
}

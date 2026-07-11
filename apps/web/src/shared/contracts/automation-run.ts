export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled'
export type AutomationRunTrigger = 'manual' | 'schedule' | 'webhook' | 'event'

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
  | 'ai.orientation.completed'
  | 'ai.plan.proposed'
  | 'ai.plan.updated'
  | 'ai.action.decided'
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

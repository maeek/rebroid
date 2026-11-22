import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-contracts'

export type ScheduledTask = OrchestratorApiSchemas['ScheduledTaskDto']
export type ScheduledTaskAction = OrchestratorApiSchemas['ScheduledTaskActionDto']
export type ScheduledTaskActionType = ScheduledTask['actionType']
export type SaveScheduledTaskInput = Omit<OrchestratorApiSchemas['CreateScheduledTaskDto'], 'enabled'> & {
  enabled?: boolean
}

export const workflowHistoryRetentionKey = 'clean-workflow-history'
export const defaultWorkflowHistoryRetentionDays = 7

export interface WorkflowHistoryRetention {
  retentionDays: number
  enabled: boolean
}

export const isWorkflowHistoryRetentionTask = (task: ScheduledTask) =>
  task.kind === 'predefined' &&
  task.predefinedKey === workflowHistoryRetentionKey &&
  task.actionType === 'clean_workflow_history'

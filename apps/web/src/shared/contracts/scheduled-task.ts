export type ScheduledTaskActionType =
  | 'clean_uploaded_apks'
  | 'prune_images'
  | 'prune_containers'
  | 'prune_networks'
  | 'prune_volumes'
  | 'prune_all'
  | 'clean_runtime_logs'
  | 'clean_workflow_history'
  | 'clean_interrupted_image_builds'
  | 'clean_image_build_history'

export const workflowHistoryRetentionKey = 'clean-workflow-history'
export const defaultWorkflowHistoryRetentionDays = 7

export interface WorkflowHistoryRetention {
  retentionDays: number
  enabled: boolean
}

export type ScheduledTaskLastStatus = 'never_run' | 'success' | 'failed'
export type ScheduledTaskKind = 'predefined' | 'custom'

export type ScheduledTaskPayload = {
  danglingOnly?: boolean
  retentionDays?: number
}

export interface ScheduledTask {
  id: string
  name: string
  enabled: boolean
  kind: ScheduledTaskKind
  predefinedKey: string | null
  cronExpression: string
  actionType: ScheduledTaskActionType
  payload: ScheduledTaskPayload | null
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: ScheduledTaskLastStatus
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export const isWorkflowHistoryRetentionTask = (task: ScheduledTask) =>
  task.kind === 'predefined' &&
  task.predefinedKey === workflowHistoryRetentionKey &&
  task.actionType === 'clean_workflow_history'

export interface ScheduledTaskAction {
  type: ScheduledTaskActionType
  label: string
  description: string
}

export interface SaveScheduledTaskInput {
  name: string
  enabled?: boolean
  cronExpression: string
  actionType: ScheduledTaskActionType
  payload?: ScheduledTaskPayload | null
}

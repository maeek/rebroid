export type ScheduledTaskActionType =
  | 'clean_uploaded_apks'
  | 'prune_images'
  | 'prune_containers'
  | 'prune_networks'
  | 'prune_volumes'
  | 'prune_all'
  | 'clean_runtime_logs'

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

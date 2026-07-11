import {
  cronToSchedule,
  dateLabel,
  defaultSchedule,
  scheduleLabel,
  scheduleToCron,
  type ScheduleDraft,
  weekdays
} from '@/shared/model/schedule/schedule-format'
import type { FormState } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTask, ScheduledTaskActionType } from '@/server/orchestrator/scheduled-tasks/types'

export { cronToSchedule, dateLabel, defaultSchedule, scheduleLabel, scheduleToCron, weekdays }

export type { ScheduleDraft }

export const actionNeedsDanglingOnly = (type: ScheduledTaskActionType) => type === 'prune_images'

export const actionNeedsRetentionDays = (type: ScheduledTaskActionType) => type === 'clean_runtime_logs'

export const defaultForm = (actionType: ScheduledTaskActionType): FormState => ({
  name: '',
  enabled: true,
  actionType,
  payload: {},
  schedule: defaultSchedule
})

export const statusVariant = (status: ScheduledTask['lastStatus']) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

export const statusLabel = (status: ScheduledTask['lastStatus']) => {
  if (status === 'never_run') return 'Never run'
  return status === 'success' ? 'Success' : 'Failed'
}

export const taskToForm = (task: ScheduledTask): FormState => ({
  id: task.id,
  name: task.name,
  enabled: task.enabled,
  kind: task.kind,
  predefinedKey: task.predefinedKey,
  actionType: task.actionType,
  payload: task.payload ?? {},
  schedule: cronToSchedule(task.cronExpression)
})

export const normalizePayload = (form: FormState) => {
  if (actionNeedsDanglingOnly(form.actionType)) {
    return { danglingOnly: form.payload?.danglingOnly ?? true }
  }

  if (actionNeedsRetentionDays(form.actionType)) {
    return { retentionDays: Number(form.payload?.retentionDays ?? 30) }
  }

  return null
}

import type { FormState } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTask, ScheduledTaskActionType } from '@/server/orchestrator/scheduled-tasks/types'
import {
  cronToSchedule,
  defaultSchedule,
  scheduleToCron,
  type ScheduleDraft,
  weekdays,
} from '@rebroid/automation-core/schedule'

export { cronToSchedule, defaultSchedule, scheduleToCron, weekdays }

export type { ScheduleDraft }

export const actionNeedsDanglingOnly = (type: ScheduledTaskActionType) =>
  type === 'prune_images'

export const actionNeedsRetentionDays = (type: ScheduledTaskActionType) =>
  type === 'clean_runtime_logs'

export const defaultForm = (actionType: ScheduledTaskActionType): FormState => ({
  name: '',
  enabled: true,
  actionType,
  payload: {},
  schedule: defaultSchedule,
})

export const scheduleLabel = (cronExpression: string) => {
  const schedule = cronToSchedule(cronExpression)
  if (schedule.frequency === 'hourly') {
    return `Every ${schedule.intervalHours} ${schedule.intervalHours === 1 ? 'hour' : 'hours'}`
  }
  if (schedule.frequency === 'weekly') {
    return `Every ${weekdays.find((day) => day.value === schedule.weekday)?.label ?? 'week'} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Monthly on day ${schedule.monthDay} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

export const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '-'

export const statusVariant = (status: ScheduledTask['lastStatus']) => {
  if (status === 'success') return 'status'
  if (status === 'failed') return 'destructive'
  return 'secondary'
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
  schedule: cronToSchedule(task.cronExpression),
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

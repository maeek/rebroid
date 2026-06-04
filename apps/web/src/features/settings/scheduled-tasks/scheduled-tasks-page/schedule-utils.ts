import type { FormState, ScheduleDraft } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'
import type { ScheduledTask, ScheduledTaskActionType } from '@/server/orchestrator/scheduled-tasks/types'

export const defaultSchedule: ScheduleDraft = {
  frequency: 'daily',
  intervalHours: 24,
  time: '03:00',
  weekday: '0',
  monthDay: 1
}

export const weekdays = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
]

export const actionNeedsDanglingOnly = (type: ScheduledTaskActionType) => type === 'prune_images'

export const actionNeedsRetentionDays = (type: ScheduledTaskActionType) => type === 'clean_runtime_logs'

export const defaultForm = (actionType: ScheduledTaskActionType): FormState => ({
  name: '',
  enabled: true,
  actionType,
  payload: {},
  schedule: defaultSchedule
})

export const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

const timeParts = (time: string) => {
  const [hour = '3', minute = '0'] = time.split(':')
  return {
    hour: clampInteger(Number(hour), 0, 23),
    minute: clampInteger(Number(minute), 0, 59)
  }
}

export const scheduleToCron = (schedule: ScheduleDraft) => {
  const { hour, minute } = timeParts(schedule.time)
  if (schedule.frequency === 'hourly') {
    return `0 */${clampInteger(schedule.intervalHours, 1, 24)} * * *`
  }
  if (schedule.frequency === 'weekly') {
    return `${minute} ${hour} * * ${schedule.weekday}`
  }
  if (schedule.frequency === 'monthly') {
    return `${minute} ${hour} ${clampInteger(schedule.monthDay, 1, 28)} * *`
  }
  return `${minute} ${hour} * * *`
}

export const cronToSchedule = (cronExpression: string): ScheduleDraft => {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.trim().split(/\s+/)
  if (minute === '0' && hour?.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...defaultSchedule, frequency: 'hourly', intervalHours: clampInteger(Number(hour.slice(2)), 1, 24) }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek && dayOfWeek !== '*') {
    return {
      ...defaultSchedule,
      frequency: 'weekly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      weekday: weekdays.some(day => day.value === dayOfWeek) ? dayOfWeek : '0'
    }
  }
  if (dayOfMonth && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return {
      ...defaultSchedule,
      frequency: 'monthly',
      time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      monthDay: clampInteger(Number(dayOfMonth), 1, 28)
    }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { ...defaultSchedule, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` }
  }
  return defaultSchedule
}

export const scheduleLabel = (cronExpression: string) => {
  const schedule = cronToSchedule(cronExpression)
  if (schedule.frequency === 'hourly') {
    return `Every ${schedule.intervalHours} ${schedule.intervalHours === 1 ? 'hour' : 'hours'}`
  }
  if (schedule.frequency === 'weekly') {
    return `Every ${weekdays.find(day => day.value === schedule.weekday)?.label ?? 'week'} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Monthly on day ${schedule.monthDay} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

export const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleString() : '-')

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

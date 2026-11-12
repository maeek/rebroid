import { defaultWorkflowHistoryRetentionDays } from '@/shared/contracts/scheduled-task'
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
import type { ScheduledTask, ScheduledTaskActionType } from '@/shared/contracts/scheduled-task'

export { cronToSchedule, dateLabel, defaultSchedule, scheduleLabel, scheduleToCron, weekdays }

export type { ScheduleDraft }

export const actionNeedsDanglingOnly = (type: ScheduledTaskActionType) => type === 'prune_images'

export const actionKeepsHistory = (type: ScheduledTaskActionType) =>
  type === 'clean_workflow_history' || type === 'clean_image_build_history'

export const defaultRetentionDaysFor = (type: ScheduledTaskActionType) =>
  type === 'clean_workflow_history' ? defaultWorkflowHistoryRetentionDays : 30

const retentionLabels: Partial<Record<ScheduledTaskActionType, string>> = {
  clean_runtime_logs: 'Remove logs older than',
  clean_workflow_history: 'Keep finished workflow runs for',
  clean_image_build_history: 'Keep completed image builds for'
}

export const retentionLabelFor = (type: ScheduledTaskActionType) => retentionLabels[type]

export const defaultForm = (actionType: ScheduledTaskActionType): FormState => ({
  name: '',
  enabled: true,
  actionType,
  payload: {},
  schedule: defaultSchedule
})

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

  if (retentionLabelFor(form.actionType)) {
    return { retentionDays: Number(form.payload?.retentionDays ?? defaultRetentionDaysFor(form.actionType)) }
  }

  return null
}

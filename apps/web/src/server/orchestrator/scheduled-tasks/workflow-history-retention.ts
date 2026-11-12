import 'server-only'
import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  defaultWorkflowHistoryRetentionDays,
  isWorkflowHistoryRetentionTask,
  type ScheduledTask,
  type WorkflowHistoryRetention
} from '@/shared/contracts/scheduled-task'
import { orchestratorScheduledTasksClient } from './client'

export const getWorkflowHistoryRetentionTask = async () => {
  const task = (await orchestratorScheduledTasksClient.list()).find(isWorkflowHistoryRetentionTask)
  if (!task) {
    throw new PublicActionError('The built-in workflow history retention task is unavailable.', {
      code: 'not_found',
      status: 404
    })
  }
  return task
}

export const toWorkflowHistoryRetention = (task: ScheduledTask): WorkflowHistoryRetention => ({
  retentionDays: task.payload?.retentionDays ?? defaultWorkflowHistoryRetentionDays,
  enabled: task.enabled
})

export const loadWorkflowHistoryRetention = async () => {
  if (!(await getCurrentUser()).isPlatformAdmin) return null

  return runSafeAction(async () => toWorkflowHistoryRetention(await getWorkflowHistoryRetentionTask()), {
    fallbackMessage: 'Could not load workflow history retention.',
    logLabel: 'Load workflow history retention'
  })
}

'use server'

import { revalidatePath } from 'next/cache'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { isWorkflowHistoryRetentionTask, type SaveScheduledTaskInput } from '@/shared/contracts/scheduled-task'
import { requireAdminUser } from '../shared'
import { orchestratorScheduledTasksClient } from './client'
import { getWorkflowHistoryRetentionTask, toWorkflowHistoryRetention } from './workflow-history-retention'

const recordScheduledTaskAudit = async (
  action: string,
  details?: Record<string, unknown>,
  resourceId?: string,
  resourceLabel?: string
) => {
  const admin = await requireAdminUser()
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action,
    resourceType: 'scheduled_task',
    resourceId,
    resourceLabel,
    details
  })
}

export const listScheduledTaskActionsAction = async () => {
  await requireAdminUser()
  return orchestratorScheduledTasksClient.listActions()
}

export const listScheduledTasksAction = async () => {
  await requireAdminUser()
  return orchestratorScheduledTasksClient.list()
}

export const createScheduledTaskAction = async (input: SaveScheduledTaskInput) => {
  await requireAdminUser()
  const task = await orchestratorScheduledTasksClient.create(input)
  await recordScheduledTaskAudit(
    'scheduled_task.create',
    { actionType: task.actionType, cronExpression: task.cronExpression },
    task.id,
    task.name
  )
  return task
}

export const updateScheduledTaskAction = async (id: string, input: Partial<SaveScheduledTaskInput>) => {
  await requireAdminUser()
  const task = await orchestratorScheduledTasksClient.update(id, input)
  const workflowHistoryTask = isWorkflowHistoryRetentionTask(task)
  await recordScheduledTaskAudit(
    'scheduled_task.update',
    {
      fields: Object.keys(input),
      actionType: task.actionType,
      ...(workflowHistoryTask &&
        input.payload?.retentionDays !== undefined && { retentionDays: task.payload?.retentionDays })
    },
    task.id,
    task.name
  )
  if (workflowHistoryTask) {
    revalidatePath('/automations')
    revalidatePath('/platform/scheduler')
  }
  return task
}

export const saveWorkflowHistoryRetentionAction = async (retentionDays: number) =>
  runSafeAction(
    async () => {
      if (!(await getCurrentUser()).isPlatformAdmin) {
        throw new PublicActionError('Only platform administrators can change workflow history retention.', {
          code: 'forbidden',
          status: 403
        })
      }
      if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
        throw new PublicActionError('Enter a whole number between 1 and 3,650 days.', {
          code: 'validation',
          status: 400
        })
      }
      const task = await getWorkflowHistoryRetentionTask()
      const saved = await updateScheduledTaskAction(task.id, { payload: { retentionDays } })
      return toWorkflowHistoryRetention(saved)
    },
    { fallbackMessage: 'Could not save workflow history retention.', logLabel: 'Save workflow history retention' }
  )

export const runScheduledTaskNowAction = async (id: string) => {
  await requireAdminUser()
  const task = await orchestratorScheduledTasksClient.runNow(id)
  await recordScheduledTaskAudit('scheduled_task.run', { actionType: task.actionType }, task.id, task.name)
  return task
}

export const deleteScheduledTaskAction = async (id: string) => {
  await requireAdminUser()
  const task = await orchestratorScheduledTasksClient.remove(id)
  await recordScheduledTaskAudit('scheduled_task.delete', { actionType: task.actionType }, task.id, task.name)
  return task
}

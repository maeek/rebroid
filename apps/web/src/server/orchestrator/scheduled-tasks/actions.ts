'use server'

import { revalidatePath } from 'next/cache'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUser, requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import {
  isWorkflowHistoryRetentionTask,
  type SaveScheduledTaskInput,
  type ScheduledTask
} from '@/shared/contracts/scheduled-task'
import { orchestratorScheduledTasksClient } from './client'
import { getWorkflowHistoryRetentionTask, toWorkflowHistoryRetention } from './workflow-history-retention'

type Admin = Awaited<ReturnType<typeof requireAdmin>>

const adminTaskAction = (fallbackMessage: string, perform: (admin: Admin) => Promise<ScheduledTask>) =>
  runSafeAction(async () => perform(await requireAdmin()), { fallbackMessage, logLabel: fallbackMessage })

function auditTask(
  admin: Admin,
  action: 'create' | 'update' | 'run' | 'delete',
  task: ScheduledTask,
  details?: Record<string, unknown>
) {
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: `scheduled_task.${action}`,
    resourceType: 'scheduled_task',
    resourceId: task.id,
    resourceLabel: task.name,
    details: { actionType: task.actionType, ...details }
  })
  return task
}

export const createScheduledTaskAction = async (input: SaveScheduledTaskInput) =>
  adminTaskAction('Could not create the maintenance task.', async admin => {
    const task = await orchestratorScheduledTasksClient.create(input)
    return auditTask(admin, 'create', task, { cronExpression: task.cronExpression })
  })

async function updateTask(admin: Admin, id: string, input: Partial<SaveScheduledTaskInput>) {
  const task = await orchestratorScheduledTasksClient.update(id, input)
  const workflowHistoryTask = isWorkflowHistoryRetentionTask(task)
  auditTask(admin, 'update', task, {
    fields: Object.keys(input),
    ...(workflowHistoryTask &&
      input.payload?.retentionDays !== undefined && { retentionDays: task.payload?.retentionDays })
  })
  if (workflowHistoryTask) {
    revalidatePath('/automations')
    revalidatePath('/platform/scheduler')
  }
  return task
}

export const updateScheduledTaskAction = async (id: string, input: Partial<SaveScheduledTaskInput>) =>
  adminTaskAction('Could not update the maintenance task.', admin => updateTask(admin, id, input))

export const saveWorkflowHistoryRetentionAction = async (retentionDays: number) =>
  runSafeAction(
    async () => {
      const admin = await getCurrentUser()
      if (!admin.isPlatformAdmin) {
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
      const saved = await updateTask(admin, task.id, { payload: { retentionDays } })
      return toWorkflowHistoryRetention(saved)
    },
    { fallbackMessage: 'Could not save workflow history retention.', logLabel: 'Save workflow history retention' }
  )

export const runScheduledTaskNowAction = async (id: string) =>
  adminTaskAction('Could not run the maintenance task.', async admin =>
    auditTask(admin, 'run', await orchestratorScheduledTasksClient.runNow(id))
  )

export const deleteScheduledTaskAction = async (id: string) =>
  adminTaskAction('Could not delete the maintenance task.', async admin =>
    auditTask(admin, 'delete', await orchestratorScheduledTasksClient.remove(id))
  )

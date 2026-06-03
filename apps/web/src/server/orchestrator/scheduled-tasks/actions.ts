'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { requireAdminUser } from '../shared'
import { orchestratorScheduledTasksClient } from './client'
import type { SaveScheduledTaskInput } from './types'

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
  await recordScheduledTaskAudit(
    'scheduled_task.update',
    { fields: Object.keys(input), actionType: task.actionType },
    task.id,
    task.name
  )
  return task
}

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

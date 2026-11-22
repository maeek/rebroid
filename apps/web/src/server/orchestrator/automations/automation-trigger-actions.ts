'use server'

import { revalidatePath } from 'next/cache'
import { requireRunnableWorkflow, recordAutomationAudit, requireAutomationUser } from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { SaveAutomationTriggerInput } from '@/shared/contracts/automation'

export const createAutomationTriggerAction = async (input: SaveAutomationTriggerInput) => {
  const user = await requireAutomationUser('automations:manage')
  await requireRunnableWorkflow(user, input.automationId, input)
  const trigger = await orchestratorAutomationsClient.createTrigger(user.ownerUserId, input)
  revalidatePath('/automations/triggers')
  recordAutomationAudit(user.ownerUserId, 'automation.trigger.create', trigger.id, trigger.name, {
    automationId: trigger.automationId,
    targetApplicationId: trigger.targetApplicationId
  })
  return trigger
}

export const updateAutomationTriggerAction = async (id: string, input: Partial<SaveAutomationTriggerInput>) => {
  const user = await requireAutomationUser('automations:manage')
  const current = await orchestratorAutomationsClient.getTrigger(user.ownerUserId, id)
  const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
  const effective = { ...current, ...patch }
  await requireRunnableWorkflow(user, effective.automationId, effective)
  const trigger = await orchestratorAutomationsClient.updateTrigger(user.ownerUserId, id, patch)
  revalidatePath('/automations/triggers')
  recordAutomationAudit(user.ownerUserId, 'automation.trigger.update', trigger.id, trigger.name, {
    fields: Object.keys(patch)
  })
  return trigger
}

export const deleteAutomationTriggerAction = async (id: string) => {
  const user = await requireAutomationUser('automations:manage')
  const trigger = await orchestratorAutomationsClient.removeTrigger(user.ownerUserId, id)
  revalidatePath('/automations/triggers')
  recordAutomationAudit(user.ownerUserId, 'automation.trigger.delete', trigger.id, trigger.name)
  return trigger
}

export const runAutomationTriggerAction = async (id: string) => {
  const user = await requireAutomationUser('automations:run')
  const trigger = await orchestratorAutomationsClient.getTrigger(user.ownerUserId, id)
  await requireRunnableWorkflow(user, trigger.automationId, trigger)
  const run = await orchestratorAutomationsClient.runTrigger(user.ownerUserId, id)
  revalidatePath('/automations/triggers')
  revalidatePath('/automations')
  revalidatePath(`/automations/${run.automationId}`)
  recordAutomationAudit(user.ownerUserId, 'automation.trigger.run', id, id, {
    runId: run.id,
    targetApplicationId: run.targetApplicationId
  })
  return run
}

'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  assertTriggerProfilePermission,
  assertTriggerTarget,
  recordAutomationAudit
} from './action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { SaveAutomationTriggerInput } from './types'

export const listAutomationTriggersAction = async () => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listTriggers(user.ownerUserId)
}

export const listAutomationTriggersGridAction = async (
  input: Parameters<typeof orchestratorAutomationsClient.listTriggersGrid>[1] = {}
) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listTriggersGrid(user.ownerUserId, input)
}

export const createAutomationTriggerAction = async (input: SaveAutomationTriggerInput) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  await assertTriggerTarget(input)
  assertTriggerProfilePermission(user, input)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, input.automationId)
  await assertDefinitionPermissions(user, automation.definition)
  const trigger = await orchestratorAutomationsClient.createTrigger(user.ownerUserId, input)
  revalidatePath('/automations/triggers')
  await recordAutomationAudit('automation.trigger.create', trigger.id, trigger.name, {
    automationId: trigger.automationId,
    targetApplicationId: trigger.targetApplicationId
  })
  return trigger
}

export const updateAutomationTriggerAction = async (id: string, input: Partial<SaveAutomationTriggerInput>) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  const current = await orchestratorAutomationsClient.getTrigger(user.ownerUserId, id)
  const effective = { ...current, ...input }
  await assertTriggerTarget(effective)
  assertTriggerProfilePermission(user, effective)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, effective.automationId)
  await assertDefinitionPermissions(user, automation.definition)
  const trigger = await orchestratorAutomationsClient.updateTrigger(user.ownerUserId, id, input)
  revalidatePath('/automations/triggers')
  await recordAutomationAudit('automation.trigger.update', trigger.id, trigger.name, { fields: Object.keys(input) })
  return trigger
}

export const deleteAutomationTriggerAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:manage')
  const trigger = await orchestratorAutomationsClient.removeTrigger(user.ownerUserId, id)
  revalidatePath('/automations/triggers')
  await recordAutomationAudit('automation.trigger.delete', trigger.id, trigger.name)
  return trigger
}

export const runAutomationTriggerAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  const trigger = await orchestratorAutomationsClient.getTrigger(user.ownerUserId, id)
  await assertTriggerTarget(trigger)
  assertTriggerProfilePermission(user, trigger)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, trigger.automationId)
  await assertDefinitionPermissions(user, automation.definition)
  const run = await orchestratorAutomationsClient.runTrigger(user.ownerUserId, id)
  revalidatePath('/automations/triggers')
  revalidatePath('/automations')
  revalidatePath(`/automations/${run.automationId}`)
  await recordAutomationAudit('automation.trigger.run', id, id, {
    runId: run.id,
    targetApplicationId: run.targetApplicationId
  })
  return run
}

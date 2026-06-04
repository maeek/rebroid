'use server'

import { revalidatePath } from 'next/cache'
import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission, type PermissionId } from '@/shared/permissions/permissions'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage
} from '../applications/actions/common/action-helpers'
import { orchestratorAutomationsClient } from './client'
import type {
  AutomationDefinition,
  AutomationDefinitionStep,
  RunAutomationInput,
  SaveAutomationInput,
  SaveAutomationTriggerInput
} from './types'

const assertPermission = (user: Awaited<ReturnType<typeof getCurrentUserContext>>, permission: PermissionId) => {
  if (user.role !== 'admin' && !hasPermission(user.permissions, permission)) {
    throw new Error('You do not have permission to use automations.')
  }
}

const commandPermissionIsKnown = (permission: string): permission is PermissionId =>
  ['automations:manage', 'automations:run', 'automations:run-adb-shell', 'automations:manage-network'].includes(
    permission
  )

const assertDefinitionPermissions = async (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  definition: AutomationDefinition
) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  const commandByUses = new Map(commands.map(command => [command.uses, command]))
  const assertStep = (step: AutomationDefinitionStep) => {
    if (!('uses' in step)) {
      if (step.type === 'condition') {
        step.then.forEach(assertStep)
        step.else?.forEach(assertStep)
        return
      }
      if (step.type === 'switch') {
        step.cases.forEach(item => item.steps.forEach(assertStep))
        step.default?.forEach(assertStep)
        return
      }
      step.steps.forEach(assertStep)
      return
    }
    const command = commandByUses.get(step.uses)
    if (!command) {
      throw new Error(`Unsupported automation command "${step.uses}".`)
    }
    for (const permission of command.requiredPermissions) {
      if (commandPermissionIsKnown(permission)) {
        assertPermission(user, permission)
      }
    }
  }
  definition.spec.steps.forEach(assertStep)
}

const assertTargetApplication = async (targetApplicationId?: string | null) => {
  if (targetApplicationId) {
    await assertCanUseOwnedApplicationRuntime(targetApplicationId, ownedRuntimeControlMessage)
  }
}

const recordAutomationAudit = async (
  action: string,
  resourceId: string,
  resourceLabel: string,
  details?: Record<string, unknown>
) => {
  const user = await getCurrentUserContext()
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action,
    resourceType: 'automation',
    resourceId,
    resourceLabel,
    details
  })
}

export const listAutomationCommandsAction = async () => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listCommands()
}

export const validateAutomationYamlAction = async (yaml: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  const validation = await orchestratorAutomationsClient.validateYaml(yaml)
  if (validation.definition) {
    await assertDefinitionPermissions(user, validation.definition)
  }
  return validation
}

export const listAutomationsAction = async () => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.list(user.ownerUserId)
}

export const listRunnableAutomationsAction = async () => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:run')
  return orchestratorAutomationsClient.listRunnable(user.ownerUserId)
}

export const getAutomationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.get(user.ownerUserId, id)
}

export const createAutomationAction = async (input: SaveAutomationInput) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  const validation = await orchestratorAutomationsClient.validateYaml(input.yaml)
  if (!validation.definition) {
    throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
  }
  await assertDefinitionPermissions(user, validation.definition)
  const automation = await orchestratorAutomationsClient.create(user.ownerUserId, {
    ...input,
    yaml: validation.yaml ?? input.yaml
  })
  revalidatePath('/automations')
  await recordAutomationAudit('automation.create', automation.id, automation.name)
  return automation
}

export const updateAutomationAction = async (id: string, input: Partial<SaveAutomationInput>) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  let payload = input
  if (input.yaml !== undefined) {
    const validation = await orchestratorAutomationsClient.validateYaml(input.yaml)
    if (!validation.definition) {
      throw new Error(validation.errors[0] ?? 'Automation YAML is invalid.')
    }
    await assertDefinitionPermissions(user, validation.definition)
    payload = { ...input, yaml: validation.yaml ?? input.yaml }
  }
  const automation = await orchestratorAutomationsClient.update(user.ownerUserId, id, payload)
  revalidatePath('/automations')
  await recordAutomationAudit('automation.update', automation.id, automation.name, { fields: Object.keys(input) })
  return automation
}

export const deleteAutomationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  const automation = await orchestratorAutomationsClient.remove(user.ownerUserId, id)
  revalidatePath('/automations')
  await recordAutomationAudit('automation.delete', automation.id, automation.name)
  return automation
}

const assertRunProfilePermission = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: RunAutomationInput
) => {
  if (
    user.role !== 'admin' &&
    (input.profileMode || input.profileName) &&
    !hasPermission(user.permissions, 'applications:switch-profile')
  ) {
    throw new Error('You do not have permission to switch application profiles.')
  }
}

export const runAutomationAction = async (id: string, input: RunAutomationInput) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:run')
  await assertTargetApplication(input.targetApplicationId)
  assertRunProfilePermission(user, input)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, id)
  await assertDefinitionPermissions(user, automation.definition)
  const run = await orchestratorAutomationsClient.run(user.ownerUserId, id, input)
  revalidatePath('/automations')
  revalidatePath(`/automations/${id}`)
  await recordAutomationAudit('automation.run', automation.id, automation.name, {
    runId: run.id,
    targetApplicationId: run.targetApplicationId,
    targetProfileMode: run.targetProfileMode,
    targetProfileName: run.targetProfileName
  })
  return run
}

export const listAutomationRunsAction = async (automationId: string, limit = 50) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listRuns(user.ownerUserId, automationId, limit)
}

const assertTriggerTarget = async (input: Partial<SaveAutomationTriggerInput>) => {
  if (input.targetApplicationId) {
    await assertTargetApplication(input.targetApplicationId)
  }
}

const assertTriggerProfilePermission = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: Partial<SaveAutomationTriggerInput>
) => {
  if (
    user.role !== 'admin' &&
    (input.profileMode || input.profileName) &&
    !hasPermission(user.permissions, 'applications:switch-profile')
  ) {
    throw new Error('You do not have permission to switch application profiles.')
  }
}

export const listAutomationTriggersAction = async () => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listTriggers(user.ownerUserId)
}

export const createAutomationTriggerAction = async (input: SaveAutomationTriggerInput) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
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
  assertPermission(user, 'automations:manage')
  await assertTriggerTarget(input)
  assertTriggerProfilePermission(user, input)
  if (input.automationId) {
    const automation = await orchestratorAutomationsClient.get(user.ownerUserId, input.automationId)
    await assertDefinitionPermissions(user, automation.definition)
  }
  const trigger = await orchestratorAutomationsClient.updateTrigger(user.ownerUserId, id, input)
  revalidatePath('/automations/triggers')
  await recordAutomationAudit('automation.trigger.update', trigger.id, trigger.name, { fields: Object.keys(input) })
  return trigger
}

export const deleteAutomationTriggerAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  const trigger = await orchestratorAutomationsClient.removeTrigger(user.ownerUserId, id)
  revalidatePath('/automations/triggers')
  await recordAutomationAudit('automation.trigger.delete', trigger.id, trigger.name)
  return trigger
}

export const runAutomationTriggerAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:run')
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

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
import type { AutomationDefinition, SaveAutomationInput } from './types'

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
  for (const step of definition.spec.steps) {
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

export const getAutomationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.get(user.ownerUserId, id)
}

export const createAutomationAction = async (input: SaveAutomationInput) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  await assertTargetApplication(input.targetApplicationId)
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
  await assertTargetApplication(input.targetApplicationId)
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

export const runAutomationAction = async (id: string, targetApplicationId?: string | null) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:run')
  await assertTargetApplication(targetApplicationId)
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, id)
  await assertTargetApplication(targetApplicationId ?? automation.targetApplicationId)
  await assertDefinitionPermissions(user, automation.definition)
  const run = await orchestratorAutomationsClient.run(user.ownerUserId, id, targetApplicationId)
  revalidatePath('/automations')
  await recordAutomationAudit('automation.run', automation.id, automation.name, {
    runId: run.id,
    targetApplicationId: run.targetApplicationId
  })
  return run
}

export const listAutomationRunsAction = async (automationId: string, limit = 50) => {
  const user = await getCurrentUserContext()
  assertPermission(user, 'automations:manage')
  return orchestratorAutomationsClient.listRuns(user.ownerUserId, automationId, limit)
}

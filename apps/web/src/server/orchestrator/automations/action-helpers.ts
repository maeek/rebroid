import { isDefaultAiCapability, isSelectableAiCapability } from '@rebroid/automation-core/ai-run'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { allPermissionIds, hasPermission, type PermissionId } from '@/shared/permissions/permissions'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage
} from '../applications/actions/common/action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { AutomationCommand, RunAutomationInput, SaveAutomationTriggerInput } from '@/shared/contracts/automation'
import type { AutomationDefinition, AutomationDefinitionStep } from '@rebroid/automation-core/definition'

export type CurrentAutomationUser = Pick<Awaited<ReturnType<typeof getCurrentUserContext>>, 'permissions'>

export const assertAutomationPermission = (user: CurrentAutomationUser, permission: PermissionId) => {
  if (!hasPermission(user.permissions, permission)) {
    throw new PublicActionError('You do not have permission to use automations.', { code: 'forbidden', status: 403 })
  }
}

const commandPermissionIsKnown = (permission: string): permission is PermissionId =>
  allPermissionIds.some(candidate => candidate === permission)

const canUseAutomationCommand = (
  user: CurrentAutomationUser,
  command: Pick<AutomationCommand, 'requiredPermissions'>
) =>
  command.requiredPermissions.every(
    permission => commandPermissionIsKnown(permission) && hasPermission(user.permissions, permission)
  )

const defaultAiCapabilitiesFor = (commands: readonly AutomationCommand[]) =>
  commands.filter(command => isDefaultAiCapability(command.uses)).map(command => command.uses)

export const assertDefinitionPermissions = async (user: CurrentAutomationUser, definition: AutomationDefinition) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  const commandByUses = new Map(commands.map(command => [command.uses, command]))
  let defaultAiCapabilities: string[] | undefined
  const assertCommandPermissions = (uses: string) => {
    const command = commandByUses.get(uses)
    if (!command) {
      throw new PublicActionError(`Unsupported automation command "${uses}".`, { code: 'validation' })
    }
    for (const permission of command.requiredPermissions) {
      if (!commandPermissionIsKnown(permission)) {
        throw new PublicActionError(`Automation command "${uses}" requires an unknown permission.`, {
          code: 'forbidden'
        })
      }
      assertAutomationPermission(user, permission)
    }
  }
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
    assertCommandPermissions(step.uses)
    if (step.uses === 'ai.run') {
      if (step.with.rawShellPolicy === 'allowlisted') assertAutomationPermission(user, 'automations:run-adb-shell')
      const { capabilities } = step.with
      if (capabilities === undefined) {
        defaultAiCapabilities ??= defaultAiCapabilitiesFor(
          commands.filter(command => canUseAutomationCommand(user, command))
        )
        return
      }
      if (!Array.isArray(capabilities) || !capabilities.every(uses => typeof uses === 'string')) {
        throw new PublicActionError('AI capabilities must be a list of command names.', { code: 'validation' })
      }
      for (const capability of capabilities) {
        const uses = capability.trim()
        if (!isSelectableAiCapability(uses)) {
          throw new PublicActionError(`Command "${uses}" is unavailable to the device agent.`, { code: 'validation' })
        }
        assertCommandPermissions(uses)
      }
    }
  }
  definition.spec.steps.forEach(assertStep)
  return defaultAiCapabilities
}

export const listPermittedAutomationCommands = async (user: CurrentAutomationUser) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  return commands.filter(command => canUseAutomationCommand(user, command))
}

export const listPermittedDraftCommands = async (user: CurrentAutomationUser) =>
  (await listPermittedAutomationCommands(user))
    .filter(command => command.uses !== 'ai.run')
    .map(command => command.uses)

export const listPermittedDefaultAiCapabilities = async (user: CurrentAutomationUser) =>
  defaultAiCapabilitiesFor(await listPermittedAutomationCommands(user))

export const assertTargetApplication = async (targetApplicationId?: string | null) => {
  if (targetApplicationId) {
    await assertCanUseOwnedApplicationRuntime(targetApplicationId, ownedRuntimeControlMessage)
  }
}

export const assertRunProfilePermission = (
  user: CurrentAutomationUser,
  input: Pick<RunAutomationInput, 'profileMode' | 'profileName'>
) => {
  if (
    (input.profileMode || input.profileName?.trim()) &&
    !hasPermission(user.permissions, 'applications:switch-profile')
  ) {
    throw new PublicActionError('You do not have permission to switch application profiles.', {
      code: 'forbidden',
      status: 403
    })
  }
}

export const assertTriggerTarget = async (input: Partial<SaveAutomationTriggerInput>) => {
  if (input.targetApplicationId) {
    await assertTargetApplication(input.targetApplicationId)
  }
}

export const recordAutomationAudit = async (
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

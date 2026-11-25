import { isDefaultAiCapability, isSelectableAiCapability } from '@rebroid/automation-core/ai-run'
import { visitAutomationSteps, type AutomationDefinition } from '@rebroid/automation-core/definition'
import { externalAutomationCapability, externalDefinitionIssue } from '@rebroid/automation-core/device-capabilities'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { allPermissionIds, hasPermission, type PermissionId } from '@/shared/permissions/permissions'
import { requireOwnedRuntimeContext, ownedRuntimeControlMessage } from '../applications/actions/common/action-helpers'
import { externalDeviceClient } from '../external-devices/client'
import { OrchestratorRequestError } from '../request'
import { orchestratorAutomationsClient } from './client'
import type { AutomationCommand, RunAutomationInput } from '@/shared/contracts/automation'

type CurrentAutomationUser = Pick<Awaited<ReturnType<typeof getCurrentUserContext>>, 'permissions'>

export const assertAutomationPermission = (user: CurrentAutomationUser, permission: PermissionId) => {
  if (!hasPermission(user.permissions, permission)) {
    throw new PublicActionError('You do not have permission to use automations.', { code: 'forbidden', status: 403 })
  }
}

export const requireAutomationUser = async (permission: PermissionId, response?: 'api') => {
  const user = await getCurrentUserContext(response)
  assertAutomationPermission(user, permission)
  return user
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

const externalPermission = {
  screen: 'applications:capture-screenshot',
  input: 'applications:control-viewer',
  clipboard: 'applications:sync-clipboard'
} as const

const allowsExternalCommand = (user: CurrentAutomationUser, uses: string) => {
  const capability = externalAutomationCapability(uses)
  return (
    capability === 'neutral' ||
    (capability !== undefined && hasPermission(user.permissions, externalPermission[capability]))
  )
}

export const assertExternalCommandPermission = (user: CurrentAutomationUser, uses: string) => {
  assertAutomationPermission(user, 'devices:use-external')
  if (!allowsExternalCommand(user, uses)) {
    throw new PublicActionError(`Command "${uses}" is unavailable for this external device or account.`, {
      code: 'forbidden',
      status: 403
    })
  }
}

export const assertDefinitionPermissions = async (
  user: CurrentAutomationUser,
  definition: AutomationDefinition,
  external = false
) => {
  if (external) {
    assertAutomationPermission(user, 'devices:use-external')
    const issue = externalDefinitionIssue(definition)
    if (issue) throw new PublicActionError(issue, { code: 'validation' })
  }
  const commands = await orchestratorAutomationsClient.listCommands()
  const commandByUses = new Map(commands.map(command => [command.uses, command]))
  let defaultAiCapabilities: string[] | undefined
  const assertCommandPermissions = (uses: string) => {
    if (external) assertExternalCommandPermission(user, uses)
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
  visitAutomationSteps(definition.spec.steps, step => {
    if (!('uses' in step)) return
    assertCommandPermissions(step.uses)
    if (step.uses === 'ai.run') {
      if (step.with.rawShellPolicy === 'allowlisted') assertAutomationPermission(user, 'automations:run-adb-shell')
      const { capabilities } = step.with
      if (capabilities === undefined) {
        defaultAiCapabilities ??= defaultAiCapabilitiesFor(
          commands.filter(
            command =>
              canUseAutomationCommand(user, command) && (!external || allowsExternalCommand(user, command.uses))
          )
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
  })
  return defaultAiCapabilities
}

export const listPermittedAutomationCommands = async (user: CurrentAutomationUser) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  return commands.filter(command => canUseAutomationCommand(user, command))
}

export const validatePermittedWorkflowYaml = async (user: CurrentAutomationUser, yaml: string) => {
  const validation = await orchestratorAutomationsClient.validateYaml(yaml)
  if (validation.definition) await assertDefinitionPermissions(user, validation.definition)
  return validation
}

export const listPermittedDraftCommands = async (user: CurrentAutomationUser, external = false) =>
  (await listPermittedAutomationCommands(user))
    .filter(command => command.uses !== 'ai.run' && (!external || allowsExternalCommand(user, command.uses)))
    .map(command => command.uses)

export const listPermittedDefaultAiCapabilities = async (user: CurrentAutomationUser, external = false) =>
  defaultAiCapabilitiesFor(
    (await listPermittedAutomationCommands(user)).filter(
      command => !external || allowsExternalCommand(user, command.uses)
    )
  )

export const assertTargetApplication = async (targetDeviceId?: string | null) => {
  if (!targetDeviceId) return
  try {
    await requireOwnedRuntimeContext(targetDeviceId, ownedRuntimeControlMessage)
  } catch (error) {
    if (!(error instanceof OrchestratorRequestError) || error.status !== 404) throw error
    const user = await getCurrentUserContext()
    assertAutomationPermission(user, 'devices:use-external')
    const device = await externalDeviceClient.get(targetDeviceId, {
      userId: user.ownerUserId,
      administrator: user.isPlatformAdmin
    })
    if (device.ownerUserId !== user.ownerUserId) {
      throw new PublicActionError('Target device was not found.', { code: 'not_found', status: 404 })
    }
    return device
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

export const requireRunnableWorkflow = async (
  user: CurrentAutomationUser & { ownerUserId: string },
  automationId: string,
  target: RunAutomationInput
) => {
  const external = await assertTargetApplication(target.targetDeviceId)
  if (external && (target.startPolicy === 'start-if-needed' || target.profileMode || target.profileName)) {
    throw new PublicActionError('External devices use their verified connection without startup or profiles.', {
      code: 'validation'
    })
  }
  assertRunProfilePermission(user, target)
  const workflow = await orchestratorAutomationsClient.get(user.ownerUserId, automationId)
  await assertDefinitionPermissions(user, workflow.definition, Boolean(external))
  return workflow
}

export const assertCurrentExternalAttachment = async (deviceId: string, attachmentId?: string) => {
  const external = await assertTargetApplication(deviceId)
  if (external && (!attachmentId || attachmentId !== external.connection.attachmentId)) {
    throw new PublicActionError('The verified attachment changed. Open the device viewer again.', {
      code: 'conflict',
      status: 409
    })
  }
}

export const recordAutomationAudit = (
  actorUserId: string,
  action: string,
  resourceId: string,
  resourceLabel: string,
  details?: Record<string, unknown>
) => {
  recordAuditEvent({
    actorUserId,
    actorLabel: actorUserId,
    category: 'application',
    action,
    resourceType: 'automation',
    resourceId,
    resourceLabel,
    details
  })
}

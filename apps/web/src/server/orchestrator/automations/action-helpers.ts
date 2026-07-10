import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission, type PermissionId } from '@/shared/permissions/permissions'
import {
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage
} from '../applications/actions/common/action-helpers'
import { orchestratorAutomationsClient } from './client'
import type { RunAutomationInput, SaveAutomationTriggerInput } from './types'
import type { AutomationDefinition, AutomationDefinitionStep } from '@rebroid/automation-core/definition'

export type CurrentAutomationUser = Awaited<ReturnType<typeof getCurrentUserContext>>

export const assertAutomationPermission = (user: CurrentAutomationUser, permission: PermissionId) => {
  if (user.role !== 'admin' && !hasPermission(user.permissions, permission)) {
    throw new Error('You do not have permission to use automations.')
  }
}

const commandPermissionIsKnown = (permission: string): permission is PermissionId =>
  [
    'automations:manage',
    'automations:run',
    'automations:run-ai',
    'automations:run-adb-shell',
    'automations:manage-network'
  ].includes(permission)

export const assertDefinitionPermissions = async (user: CurrentAutomationUser, definition: AutomationDefinition) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  const commandByUses = new Map(commands.map(command => [command.uses, command]))
  const assertCommandPermissions = (uses: string) => {
    const command = commandByUses.get(uses)
    if (!command) {
      throw new Error(`Unsupported automation command "${uses}".`)
    }
    for (const permission of command.requiredPermissions) {
      if (commandPermissionIsKnown(permission)) {
        assertAutomationPermission(user, permission)
      }
    }
  }
  const nestedAiTools = (step: Extract<AutomationDefinitionStep, { uses: string }>) => {
    const allowedTools = step.with.capabilities ?? step.with.allowedTools
    if (Array.isArray(allowedTools)) {
      return allowedTools.filter((uses): uses is string => typeof uses === 'string' && uses !== 'ai.run')
    }
    const safeDefaults = new Set([
      'android.wait',
      'android.viewerCommand',
      'android.expandNotifications',
      'android.expandQuickSettings',
      'android.openSystemSettings',
      'android.launchPackage',
      'android.listPackages',
      'android.getSetting',
      'android.tapNormalized',
      'android.swipeNormalized',
      'android.inputText',
      'android.key',
      'android.getClipboard'
    ])
    return commands.filter(command => safeDefaults.has(command.uses)).map(command => command.uses)
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
      for (const uses of nestedAiTools(step)) {
        assertCommandPermissions(uses)
      }
    }
  }
  definition.spec.steps.forEach(assertStep)
}

export const listPermittedAiTools = async (user: CurrentAutomationUser) => {
  const commands = await orchestratorAutomationsClient.listCommands()
  return commands
    .filter(command => command.uses !== 'ai.run')
    .filter(command =>
      command.requiredPermissions.every(
        permission =>
          !commandPermissionIsKnown(permission) || user.role === 'admin' || hasPermission(user.permissions, permission)
      )
    )
    .map(command => command.uses)
}

export const assertTargetApplication = async (targetApplicationId?: string | null) => {
  if (targetApplicationId) {
    await assertCanUseOwnedApplicationRuntime(targetApplicationId, ownedRuntimeControlMessage)
  }
}

export const assertRunProfilePermission = (user: CurrentAutomationUser, input: RunAutomationInput) => {
  if (
    user.role !== 'admin' &&
    (input.profileMode || input.profileName) &&
    !hasPermission(user.permissions, 'applications:switch-profile')
  ) {
    throw new Error('You do not have permission to switch application profiles.')
  }
}

export const assertTriggerTarget = async (input: Partial<SaveAutomationTriggerInput>) => {
  if (input.targetApplicationId) {
    await assertTargetApplication(input.targetApplicationId)
  }
}

export const assertTriggerProfilePermission = (
  user: CurrentAutomationUser,
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

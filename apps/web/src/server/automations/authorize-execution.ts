import 'server-only'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { enforceRuntimeQuotas } from '@/server/orchestrator/applications/resource-quota'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  assertExternalCommandPermission,
  assertRunProfilePermission
} from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { listExternalWorkflowDevices } from '@/server/orchestrator/automations/workflow-device-options'
import { externalDeviceClient } from '@/server/orchestrator/external-devices/client'
import { hasPermission } from '@/shared/permissions/permissions'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

export const authorizeAutomationExecution = async (input: {
  ownerUserId: string
  definition: AutomationDefinition
  targetDeviceId: string
  attachmentId?: string
  command?: string
  profileMode?: string | null
  profileName?: string | null
  operation: 'attach' | 'start'
}) => {
  const account = await userService.getUserById(input.ownerUserId)
  if (!account || account.disabled || account.passwordChangeRequired) {
    throw new PublicActionError('Account is not authorized.', { code: 'forbidden', status: 403 })
  }
  const user = {
    ownerUserId: account.id,
    permissions: account.effectivePermissions,
    quotas: account.effectiveQuotas
  }
  assertAutomationPermission(user, 'automations:run')
  const external = input.attachmentId !== undefined
  const defaultAiCapabilities = external
    ? await assertDefinitionPermissions(user, input.definition, true)
    : await assertDefinitionPermissions(user, input.definition)
  if (input.attachmentId) {
    if (input.operation !== 'attach' || input.profileMode || input.profileName) {
      throw new PublicActionError('Verified external devices support attachment only.', {
        code: 'forbidden',
        status: 403
      })
    }
    if (input.command) assertExternalCommandPermission(user, input.command)
    await externalDeviceClient.attachment(input.targetDeviceId, input.attachmentId, {
      userId: account.id,
      administrator: account.isPlatformAdmin
    })
    return { maxOpenApps: user.quotas.maxOpenApps, canUseInternet: false, defaultAiCapabilities }
  }
  assertRunProfilePermission(user, input)
  const app = await orchestratorAppCatalogClient.getApplication(input.targetDeviceId)
  if (app.ownerUserId !== account.id)
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  if (input.operation === 'start') {
    assertAutomationPermission(user, 'applications:start')
    const quotas = await enforceRuntimeQuotas(app.runtime, user.quotas)
    const limit = quotas.maxOpenApps
    if (limit !== null) {
      const [apps, runs, externalDevices] = await Promise.all([
        orchestratorAppCatalogClient.listApplicationGallery(account.id),
        orchestratorAutomationsClient.listActiveRuns(account.id),
        listExternalWorkflowDevices({ ...user, isPlatformAdmin: account.isPlatformAdmin }, true)
      ])
      const reserved = new Set(runs.map(run => run.targetDeviceId))
      for (const item of apps) {
        if (item.ownerUserId === account.id && (item.status === 'running' || item.status === 'provisioning'))
          reserved.add(item.id)
      }
      for (const device of externalDevices) {
        if (device.connection.attemptId) reserved.add(device.id)
      }
      reserved.add(app.id)
      if (reserved.size > limit)
        throw new PublicActionError('Open application quota exceeded.', { code: 'forbidden', status: 403 })
    }
  }
  return {
    maxOpenApps: user.quotas.maxOpenApps,
    canUseInternet: hasPermission(user.permissions, 'applications:use-internet'),
    ...(defaultAiCapabilities === undefined ? {} : { defaultAiCapabilities })
  }
}

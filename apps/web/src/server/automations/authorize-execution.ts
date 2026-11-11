import 'server-only'
import { userService } from '@/server/auth/user'
import { PublicActionError } from '@/server/errors/public-action-error'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import { getEnforcedResourceQuota } from '@/server/orchestrator/applications/resource-quota'
import { enforceResourceQuotas, enforceSessionQuota } from '@/server/orchestrator/applications/safety'
import {
  assertAutomationPermission,
  assertDefinitionPermissions,
  assertRunProfilePermission
} from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import type { AutomationDefinition } from '@rebroid/automation-core/definition'

export const authorizeAutomationExecution = async (input: {
  ownerUserId: string
  definition: AutomationDefinition
  targetApplicationId: string
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
    role: account.role,
    permissions: account.effectivePermissions,
    quotas: account.effectiveQuotas
  }
  assertAutomationPermission(user, 'automations:run')
  await assertDefinitionPermissions(user, input.definition)
  assertRunProfilePermission(user, input)
  const app = await orchestratorAppCatalogClient.getApplication(input.targetApplicationId)
  if (app.ownerUserId !== account.id)
    throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
  if (input.operation === 'start') {
    assertAutomationPermission(user, 'applications:start')
    const quotas = await getEnforcedResourceQuota(user.quotas)
    enforceResourceQuotas(app.runtime.resources, quotas)
    enforceSessionQuota({ inactivityTimeoutSeconds: app.runtime.inactivityTimeoutSeconds }, quotas)
    const limit = quotas.maxOpenApps
    if (limit !== null) {
      const [apps, runs] = await Promise.all([
        orchestratorAppCatalogClient.listApplications(account.id),
        orchestratorAutomationsClient.listActiveRuns(account.id)
      ])
      const reserved = new Set(
        apps.filter(item => ['running', 'provisioning'].includes(item.status.currentStatus)).map(item => item.id)
      )
      runs.forEach(run => reserved.add(run.targetApplicationId))
      reserved.add(app.id)
      if (reserved.size > limit)
        throw new PublicActionError('Open application quota exceeded.', { code: 'forbidden', status: 403 })
    }
  }
  return user.quotas.maxOpenApps
}

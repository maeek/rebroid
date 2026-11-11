'use server'

import { allowsBroadInternetAccess } from '@rebroid/firewall-policy-core/policy'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { requireFeature } from '../../../features'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppNetworkPolicyClient } from '../../network-policy-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import { assertCanAccessApplication } from '../common/action-helpers'
import type { UpdateNetworkPolicyInput } from '@/shared/contracts/application'

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) =>
  runSafeAction(
    async () => {
      await assertCanAccessApplication(id)
      const user = await getCurrentUserContext()
      if (!hasPermission(user.permissions, 'applications:configure-egress')) {
        throw new PublicActionError('You do not have permission to configure network access.', {
          code: 'forbidden',
          status: 403
        })
      }
      if (
        (input.networkPolicyEnabled === false || allowsBroadInternetAccess(input.networkPolicyAllowCidrs ?? [])) &&
        !hasPermission(user.permissions, 'applications:use-internet')
      ) {
        throw new PublicActionError('You do not have permission to allow broad internet access.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppNetworkPolicyClient.updateNetworkPolicy(id, input)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.network.update',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: command.name,
        details: {
          networkPolicyEnabled: input.networkPolicyEnabled,
          allowCidrsCount: input.networkPolicyAllowCidrs?.length ?? 0
        }
      })
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      const app = await orchestratorAppCatalogClient.getApplication(id)
      return sanitizeAndroidApplicationForUser(app, user)
    },
    {
      fallbackMessage: 'Could not save network policy. Restricted access requires the Firewall feature to be enabled.',
      logLabel: 'updateNetworkPolicyAction failed'
    }
  )

export const applyNetworkPolicyAction = async (id: string) =>
  runSafeAction(
    async () => {
      await assertCanAccessApplication(id)
      const user = await getCurrentUserContext()
      if (!hasPermission(user.permissions, 'applications:configure-egress')) {
        throw new PublicActionError('You do not have permission to apply network policy.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppNetworkPolicyClient.applyNetworkPolicy(id)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.network.apply',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: command.name
      })
      revalidateApplicationDetail(id)
      const app = await orchestratorAppCatalogClient.getApplication(id)
      return sanitizeAndroidApplicationForUser(app, user)
    },
    {
      fallbackMessage: 'Could not apply network policy. Restricted access requires the Firewall feature to be enabled.',
      logLabel: 'applyNetworkPolicyAction failed'
    }
  )

export const reconcileNetworkPoliciesAction = async () => {
  await requireFeature('feature.firewall')
  const user = await getCurrentUserContext()
  if (!user.isPlatformAdmin) {
    throw new PublicActionError('You do not have permission to reconcile all network policies.', {
      code: 'forbidden',
      status: 403
    })
  }
  const result = await orchestratorAppNetworkPolicyClient.reconcileNetworkPolicies()
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.network.reconcile',
    resourceType: 'network_policy'
  })
  return result
}

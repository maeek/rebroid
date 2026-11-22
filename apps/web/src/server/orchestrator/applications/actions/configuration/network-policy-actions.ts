'use server'

import { z } from 'zod'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { requireFeature } from '../../../features'
import { OrchestratorRequestError } from '../../../request'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppNetworkPolicyClient } from '../../network-policy-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import { getAccessibleApplication } from '../common/action-helpers'
import type { UpdateNetworkPolicyInput } from '@/shared/contracts/application'

const networkPolicyUpdateSchema = z.strictObject({
  networkPolicyEnabled: z.boolean().optional(),
  networkPolicyAllowCidrs: z.array(z.string().max(64)).optional()
})

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) =>
  runSafeAction(
    async () => {
      const { user } = await getAccessibleApplication(id)
      if (!hasPermission(user.permissions, 'applications:configure-egress')) {
        throw new PublicActionError('You do not have permission to configure network access.', {
          code: 'forbidden',
          status: 403
        })
      }
      const policy = networkPolicyUpdateSchema.safeParse(input)
      if (!policy.success) {
        throw new PublicActionError('Invalid network policy settings.', { code: 'validation', status: 400 })
      }
      const command = await orchestratorAppNetworkPolicyClient
        .updateNetworkPolicy(id, policy.data, hasPermission(user.permissions, 'applications:use-internet'))
        .catch((error: unknown) => {
          if (error instanceof OrchestratorRequestError && error.details?.code === 'network_egress_forbidden') {
            throw new PublicActionError('You do not have permission to allow broad internet access.', {
              code: 'forbidden',
              status: 403
            })
          }
          throw error
        })
      recordApplicationAudit(
        user.ownerUserId,
        'application.network.update',
        { id, name: command.name },
        {
          networkPolicyEnabled: policy.data.networkPolicyEnabled,
          allowCidrsCount: policy.data.networkPolicyAllowCidrs?.length ?? 0
        }
      )
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
      const { user } = await getAccessibleApplication(id)
      if (!hasPermission(user.permissions, 'applications:configure-egress')) {
        throw new PublicActionError('You do not have permission to apply network policy.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppNetworkPolicyClient.applyNetworkPolicy(id)
      recordApplicationAudit(user.ownerUserId, 'application.network.apply', { id, name: command.name })
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

'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { logger } from '@/server/observability/logger'
import { isApplicationId } from '@/shared/model/application-id'
import { hasPermission } from '@/shared/permissions/permissions'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { getEnforcedResourceQuota } from '../../resource-quota'
import { enforceResourceQuotas, enforceSessionQuota } from '../../safety'
import { assertCanOpenApplicationSlot, getAccessibleApplication } from '../common/action-helpers'

export const requestApplicationCloneAction = async (id: string) =>
  runSafeAction(
    async requestId => {
      if (!isApplicationId(id)) {
        throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
      }
      const { app: source, user } = await getAccessibleApplication(id)
      if (!hasPermission(user.permissions, 'applications:create')) {
        throw new PublicActionError('You do not have permission to create applications.', {
          code: 'forbidden',
          status: 403
        })
      }

      const quotas = await getEnforcedResourceQuota(user.quotas)
      enforceResourceQuotas(source.runtime.resources, quotas)
      enforceSessionQuota({ inactivityTimeoutSeconds: source.runtime.inactivityTimeoutSeconds }, quotas)
      await assertCanOpenApplicationSlot(user.ownerUserId, quotas.maxOpenApps)
      const command = await orchestratorAppCatalogClient.cloneApplication(
        id,
        {
          ownerUserId: user.ownerUserId
        },
        user.quotas.maxOpenApps,
        user
      )
      if (!isApplicationId(command.id)) throw new Error('The orchestrator returned an invalid application ID.')
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.clone',
        resourceType: 'application',
        resourceId: command.id,
        resourceLabel: command.name,
        details: { sourceApplicationId: id }
      })
      try {
        await cloneStoredAppIcon(id, command.id)
      } catch {
        logger.warn('application.clone_icon_failed', { requestId, applicationId: command.id })
      }
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      revalidateApplicationDetail(command.id)
      return { id: command.id }
    },
    { fallbackMessage: 'Could not open app as your copy.' }
  )

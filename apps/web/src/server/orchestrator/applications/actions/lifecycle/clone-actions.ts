'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { logger } from '@/server/observability/logger'
import { isApplicationId } from '@/shared/model/application-id'
import { hasPermission } from '@/shared/permissions/permissions'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { enforceRuntimeQuotas } from '../../resource-quota'
import { getAccessibleApplication } from '../common/action-helpers'

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

      await enforceRuntimeQuotas(source.runtime, user.quotas)
      const command = await orchestratorAppCatalogClient.cloneApplication(
        id,
        {
          ownerUserId: user.ownerUserId
        },
        user.quotas.maxOpenApps,
        user
      )
      if (!isApplicationId(command.id)) throw new Error('The orchestrator returned an invalid application ID.')
      recordApplicationAudit(user.ownerUserId, 'application.clone', command, { sourceApplicationId: id })
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
    { fallbackMessage: 'Could not copy app.' }
  )

'use server'

import { after } from 'next/server'
import { runSafeAction } from '@/server/actions/safe-action'
import { recordApplicationAudit } from '@/server/audit/application-event'
import { PublicActionError } from '@/server/errors/public-action-error'
import { runWebMaintenance } from '@/server/maintenance/web-maintenance'
import { logger } from '@/server/observability/logger'
import { isApplicationId } from '@/shared/model/application-id'
import { hasPermission } from '@/shared/permissions/permissions'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppLifecycleClient } from '../../lifecycle-client'
import { getEnforcedResourceQuota } from '../../resource-quota'
import { enforceResourceQuotas, enforceSessionQuota } from '../../safety'
import {
  assertCanUseOwnedApplicationRuntime,
  getAccessibleApplication,
  ownedRuntimeControlMessage
} from '../common/action-helpers'
import { requestTrackedApplicationDeletion } from './deletion-cleanup'
import type { ApplicationPowerAcknowledgement, SwitchApplicationProfileInput } from '@/shared/contracts/application'

const assertValidApplicationId = (id: string) => {
  if (!isApplicationId(id)) throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
}

export const requestApplicationStartAction = async (id: string, input?: SwitchApplicationProfileInput) =>
  runSafeAction<ApplicationPowerAcknowledgement>(
    async () => {
      assertValidApplicationId(id)
      const { app: currentApp, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
      if (!hasPermission(user.permissions, 'applications:start')) {
        throw new PublicActionError('You do not have permission to start applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      if (input && !hasPermission(user.permissions, 'applications:switch-profile')) {
        throw new PublicActionError('You do not have permission to switch profiles.', {
          code: 'forbidden',
          status: 403
        })
      }
      const quotas = await getEnforcedResourceQuota(user.quotas)
      enforceResourceQuotas(currentApp.runtime.resources, quotas)
      enforceSessionQuota({ inactivityTimeoutSeconds: currentApp.runtime.inactivityTimeoutSeconds }, quotas)
      const command = await orchestratorAppLifecycleClient.startApplication(id, input, user.quotas.maxOpenApps)
      recordApplicationAudit(
        user.ownerUserId,
        'application.start',
        { id, name: command.name },
        input ? { profileMode: input.profileMode, profileName: input.profileName } : undefined
      )
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      return {
        status: command.status,
        lifecycleStage: command.lifecycleStage,
        message: command.message,
        profile: command.profile
      }
    },
    { fallbackMessage: 'Could not start app.' }
  )

export const requestApplicationStopAction = async (id: string) =>
  runSafeAction<ApplicationPowerAcknowledgement>(
    async () => {
      assertValidApplicationId(id)
      const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
      if (!hasPermission(user.permissions, 'applications:stop')) {
        throw new PublicActionError('You do not have permission to stop applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppLifecycleClient.stopApplication(id)
      recordApplicationAudit(user.ownerUserId, 'application.stop', { id, name: command.name })
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      return {
        status: command.status,
        lifecycleStage: command.lifecycleStage,
        message: command.message,
        profile: command.profile
      }
    },
    { fallbackMessage: 'Could not stop app.' }
  )

export const recreateApplicationAction = async (id: string) =>
  runSafeAction(
    async () => {
      assertValidApplicationId(id)
      const { app, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
      if (
        !hasPermission(user.permissions, 'applications:start') ||
        !hasPermission(user.permissions, 'applications:stop')
      ) {
        throw new PublicActionError('Recreating an app requires permission to start and stop it.', {
          code: 'forbidden',
          status: 403
        })
      }
      const quotas = await getEnforcedResourceQuota(user.quotas)
      enforceResourceQuotas(app.runtime.resources, quotas)
      enforceSessionQuota({ inactivityTimeoutSeconds: app.runtime.inactivityTimeoutSeconds }, quotas)
      const command = await orchestratorAppLifecycleClient.recreateApplication(id, user.quotas.maxOpenApps)
      recordApplicationAudit(user.ownerUserId, 'application.recreate', { id, name: command.name })
      revalidateApplicationList()
      revalidateApplicationDetail(id)
    },
    { fallbackMessage: 'Make sure the app is stopped and try again.' }
  )

export const deleteApplicationProfileAction = async (id: string, profileName: string) =>
  runSafeAction(
    async () => {
      assertValidApplicationId(id)
      const { user } = await getAccessibleApplication(id)
      if (!hasPermission(user.permissions, 'applications:delete')) {
        throw new PublicActionError('You do not have permission to delete application profiles.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppLifecycleClient.deleteSavedProfile(id, profileName)
      recordApplicationAudit(
        user.ownerUserId,
        'application.profile.delete',
        { id, name: command.name },
        { profileName }
      )
      revalidateApplicationList()
      revalidateApplicationDetail(id)
    },
    { fallbackMessage: 'Could not remove the saved profile.' }
  )

export const requestApplicationDeletionAction = async (id: string, removeData = true) =>
  runSafeAction(
    async requestId => {
      assertValidApplicationId(id)
      const { user } = await getAccessibleApplication(id)
      if (!hasPermission(user.permissions, 'applications:delete')) {
        throw new PublicActionError('You do not have permission to delete applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      const { acknowledgement, jobId } = await requestTrackedApplicationDeletion(id, removeData, requestId)
      if (jobId) {
        try {
          after(async () => {
            await runWebMaintenance(jobId)
          })
        } catch {
          logger.warn('application.delete_cleanup_deferred', { requestId, applicationId: id })
        }
      }
      recordApplicationAudit(user.ownerUserId, 'application.delete', { id }, { removeData })
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      return acknowledgement
    },
    { fallbackMessage: 'Could not delete app.' }
  )

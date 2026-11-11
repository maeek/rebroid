'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { recordAuditEvent } from '@/server/audit/events'
import { PublicActionError } from '@/server/errors/public-action-error'
import { isApplicationId } from '@/shared/model/application-id'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppLifecycleClient } from '../../lifecycle-client'
import { getEnforcedResourceQuota } from '../../resource-quota'
import { enforceResourceQuotas, enforceSessionQuota, sanitizeAndroidApplicationForUser } from '../../safety'
import {
  assertCanAccessApplication,
  assertCanOpenApplicationSlot,
  assertCanUseOwnedApplicationRuntime,
  getAccessibleApplication,
  ownedRuntimeControlMessage
} from '../common/action-helpers'
import { scheduleApplicationDeletionCleanup } from './deletion-cleanup'
import type { ApplicationPowerAcknowledgement, SwitchApplicationProfileInput } from '@/shared/contracts/application'

const assertValidApplicationId = (id: string) => {
  if (!isApplicationId(id)) throw new PublicActionError('Application not found.', { code: 'not_found', status: 404 })
}

export const requestApplicationStartAction = async (id: string, input?: SwitchApplicationProfileInput) =>
  runSafeAction<ApplicationPowerAcknowledgement>(
    async () => {
      assertValidApplicationId(id)
      const { app: currentApp, user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
      if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:start')) {
        throw new PublicActionError('You do not have permission to start applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      if (input && user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
        throw new PublicActionError('You do not have permission to switch profiles.', {
          code: 'forbidden',
          status: 403
        })
      }
      const quotas = await getEnforcedResourceQuota(user.quotas)
      enforceResourceQuotas(currentApp.runtime.resources, quotas)
      enforceSessionQuota({ inactivityTimeoutSeconds: currentApp.runtime.inactivityTimeoutSeconds }, quotas)
      await assertCanOpenApplicationSlot(user.ownerUserId, quotas.maxOpenApps, id)
      const command = await orchestratorAppLifecycleClient.startApplication(id, input, user.quotas.maxOpenApps)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.start',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: command.name,
        details: input ? { profileMode: input.profileMode, profileName: input.profileName } : undefined
      })
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
      if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:stop')) {
        throw new PublicActionError('You do not have permission to stop applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      const command = await orchestratorAppLifecycleClient.stopApplication(id)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.stop',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: command.name
      })
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
        user.role !== 'admin' &&
        (!hasPermission(user.permissions, 'applications:start') ||
          !hasPermission(user.permissions, 'applications:stop'))
      ) {
        throw new PublicActionError('Recreating an app requires permission to start and stop it.', {
          code: 'forbidden',
          status: 403
        })
      }
      const quotas = await getEnforcedResourceQuota(user.quotas)
      enforceResourceQuotas(app.runtime.resources, quotas)
      enforceSessionQuota({ inactivityTimeoutSeconds: app.runtime.inactivityTimeoutSeconds }, quotas)
      await assertCanOpenApplicationSlot(user.ownerUserId, quotas.maxOpenApps, id)
      const command = await orchestratorAppLifecycleClient.recreateApplication(id, user.quotas.maxOpenApps)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.recreate',
        resourceType: 'application',
        resourceId: id,
        resourceLabel: command.name
      })
      revalidateApplicationList()
      revalidateApplicationDetail(id)
    },
    { fallbackMessage: 'Make sure the app is stopped and try again.' }
  )

export const deleteApplicationProfileAction = async (id: string, profileName: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:delete')) {
    throw new PublicActionError('You do not have permission to delete application profiles.', {
      code: 'forbidden',
      status: 403
    })
  }
  const command = await orchestratorAppLifecycleClient.deleteSavedProfile(id, profileName)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.profile.delete',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: command.name,
    details: { profileName }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  const app = await orchestratorAppCatalogClient.getApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const requestApplicationDeletionAction = async (id: string, removeData = true) =>
  runSafeAction(
    async requestId => {
      assertValidApplicationId(id)
      const { user } = await getAccessibleApplication(id)
      if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:delete')) {
        throw new PublicActionError('You do not have permission to delete applications.', {
          code: 'forbidden',
          status: 403
        })
      }
      const acknowledgement = await orchestratorAppCatalogClient.deleteApplication(id, removeData)
      recordAuditEvent({
        actorUserId: user.ownerUserId,
        actorLabel: user.ownerUserId,
        category: 'application',
        action: 'application.delete',
        resourceType: 'application',
        resourceId: id,
        details: { removeData }
      })
      scheduleApplicationDeletionCleanup({ ...acknowledgement, id }, user.ownerUserId, requestId)
      revalidateApplicationList()
      revalidateApplicationDetail(id)
      return acknowledgement
    },
    { fallbackMessage: 'Could not delete app.' }
  )

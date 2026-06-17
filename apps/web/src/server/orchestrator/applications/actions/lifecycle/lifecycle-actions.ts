'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import { orchestratorAppLifecycleClient } from '../../lifecycle-client'
import { sanitizeAndroidApplicationForUser } from '../../safety'
import {
  assertCanAccessApplication,
  assertCanOpenApplicationSlot,
  assertCanUseOwnedApplicationRuntime,
  ownedRuntimeControlMessage
} from '../common/action-helpers'
import type { SwitchApplicationProfileInput } from '../../types'

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:start')) {
    throw new Error('You do not have permission to start applications.')
  }
  if (input && user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
    throw new Error('You do not have permission to switch profiles.')
  }
  await assertCanOpenApplicationSlot(user, id)
  const command = await orchestratorAppLifecycleClient.startApplication(id, input)
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
  const app = await orchestratorAppCatalogClient.getApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const stopApplicationAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id, ownedRuntimeControlMessage)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:stop')) {
    throw new Error('You do not have permission to stop applications.')
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
  const app = await orchestratorAppCatalogClient.getApplication(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const deleteApplicationProfileAction = async (id: string, profileName: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:delete')) {
    throw new Error('You do not have permission to delete application profiles.')
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

export const deleteApplicationAction = async (id: string, removeData = true) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:delete')) {
    throw new Error('You do not have permission to delete applications.')
  }
  const result = await orchestratorAppCatalogClient.deleteApplication(id, removeData)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.delete',
    resourceType: 'application',
    resourceId: id,
    details: { removeData }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return result
}

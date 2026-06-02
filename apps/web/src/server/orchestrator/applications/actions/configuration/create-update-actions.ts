'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { hasPermission, isRedroidImage } from '@/shared/permissions/permissions'
import { applyRedroidDefaultContainerArgs } from '@/shared/runtime/redroid-runtime'
import { getCurrentOwnerUserId, getCurrentUserContext } from '../../../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../../../shared'
import { orchestratorApplicationsClient } from '../../client'
import { enforceResourceQuotas, enforceSessionQuota, sanitizeAndroidApplicationForUser } from '../../safety'
import { assertCanAccessApplication, assertCanOpenApplicationSlot } from '../common/action-helpers'
import type { CreateApplicationActionInput, UpdateAndroidApplicationInput } from '../../types'

const assertCanChangeResources = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (
    (input.memoryLimitMb !== undefined || input.cpuLimitCpus !== undefined || input.volumeSizeLimitMb !== undefined) &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-resources')
  ) {
    throw new Error('You do not have permission to change resource limits.')
  }
}

const assertCanChangeSessionLimit = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (
    input.inactivityTimeoutSeconds !== undefined &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-session-limit')
  ) {
    throw new Error('You do not have permission to change session limits.')
  }
}

const assertCanChangeContainerArgs = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: UpdateAndroidApplicationInput
) => {
  if (
    input.containerArgs !== undefined &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-container-args')
  ) {
    throw new Error('You do not have permission to change container arguments.')
  }
}

const assertCanUseContainerImage = (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  input: CreateApplicationActionInput
) => {
  if (
    input.containerImage &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-base-image')
  ) {
    throw new Error('You do not have permission to change the base image.')
  }
  if (
    input.containerImage &&
    isRedroidImage(input.containerImage) &&
    !hasPermission(user.permissions, 'applications:use-redroid-images')
  ) {
    throw new Error('You do not have permission to use Redroid images.')
  }
  if (
    input.containerImage &&
    !isRedroidImage(input.containerImage) &&
    !hasPermission(user.permissions, 'applications:use-custom-images')
  ) {
    throw new Error('You do not have permission to use custom images.')
  }
}

export const updateApplicationAction = async (id: string, input: UpdateAndroidApplicationInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  assertCanChangeResources(user, input)
  assertCanChangeSessionLimit(user, input)
  assertCanChangeContainerArgs(user, input)
  enforceResourceQuotas(input, user.quotas)
  enforceSessionQuota(input, user.quotas)
  const app = await orchestratorApplicationsClient.updateApplication(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.update',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { fields: Object.keys(input) }
  })
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const createApplicationAction = async (input: CreateApplicationActionInput) => {
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:create')) {
    throw new Error('You do not have permission to create applications.')
  }
  assertCanUseContainerImage(user, input)
  assertCanChangeResources(user, input)
  assertCanChangeSessionLimit(user, input)
  assertCanChangeContainerArgs(user, input)
  enforceResourceQuotas(input, user.quotas)
  enforceSessionQuota(input, user.quotas)
  await assertCanOpenApplicationSlot(user)
  const ownerUserId = await getCurrentOwnerUserId()
  const containerImage = input.containerImage?.trim()
  const app = await orchestratorApplicationsClient.createApplication({
    ...input,
    ownerUserId,
    containerArgs: containerImage
      ? applyRedroidDefaultContainerArgs(containerImage, input.containerArgs ?? '') || undefined
      : input.containerArgs
  })
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.create',
    resourceType: 'application',
    resourceId: app.id,
    resourceLabel: app.name
  })
  revalidateApplicationList()
  return sanitizeAndroidApplicationForUser(app, user)
}

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:update-apk')) {
    throw new Error('You do not have permission to update APKs.')
  }
  const app = await orchestratorApplicationsClient.updateApk(id, uploadedApkId)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.apk.update',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { uploadedApkId }
  })
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

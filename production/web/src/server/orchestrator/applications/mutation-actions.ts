'use server'

import { hasPermission, isBroadInternetCidr, isRedroidImage } from '@/shared/permissions/permissions'
import { getCurrentOwnerUserId, getCurrentUserContext } from '../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../shared'
import { orchestratorApplicationsClient } from './client'
import { getApplicationAction } from './read-actions'
import { enforceResourceQuotas, enforceSessionQuota, sanitizeAndroidApplicationForUser } from './safety'
import type {
  CreateApplicationActionInput,
  SwitchApplicationProfileInput,
  UpdateAndroidApplicationInput,
  UpdateNetworkPolicyInput
} from './types'

const assertCanAccessApplication = async (id: string) => {
  await getApplicationAction(id)
}

export const updateApplicationAction = async (id: string, input: UpdateAndroidApplicationInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (
    (input.memoryLimitMb !== undefined || input.cpuLimitCpus !== undefined || input.volumeSizeLimitMb !== undefined) &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-resources')
  ) {
    throw new Error('You do not have permission to change resource limits.')
  }
  if (
    input.inactivityTimeoutSeconds !== undefined &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-session-limit')
  ) {
    throw new Error('You do not have permission to change session limits.')
  }
  if (
    input.containerArgs !== undefined &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-container-args')
  ) {
    throw new Error('You do not have permission to change container arguments.')
  }
  enforceResourceQuotas(input, user.quotas)
  enforceSessionQuota(input, user.quotas)
  const app = await orchestratorApplicationsClient.updateApplication(id, input)
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const createApplicationAction = async (input: CreateApplicationActionInput) => {
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:create')) {
    throw new Error('You do not have permission to create applications.')
  }
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
  if (
    (input.memoryLimitMb !== undefined || input.cpuLimitCpus !== undefined || input.volumeSizeLimitMb !== undefined) &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-resources')
  ) {
    throw new Error('You do not have permission to change resource limits.')
  }
  if (
    input.inactivityTimeoutSeconds !== undefined &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-session-limit')
  ) {
    throw new Error('You do not have permission to change session limits.')
  }
  if (
    input.containerArgs &&
    user.role !== 'admin' &&
    !hasPermission(user.permissions, 'applications:change-container-args')
  ) {
    throw new Error('You do not have permission to change container arguments.')
  }
  enforceResourceQuotas(input, user.quotas)
  enforceSessionQuota(input, user.quotas)
  const ownerUserId = await getCurrentOwnerUserId()
  const app = await orchestratorApplicationsClient.createApplication({ ...input, ownerUserId })
  revalidateApplicationList()
  return sanitizeAndroidApplicationForUser(app, user)
}

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:start')) {
    throw new Error('You do not have permission to start applications.')
  }
  if (input && user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
    throw new Error('You do not have permission to switch profiles.')
  }
  if (user.quotas.maxOpenApps !== null) {
    const apps = await orchestratorApplicationsClient.listApplications(user.ownerUserId)
    const openApps = apps.filter(app => ['running', 'provisioning'].includes(app.status.currentStatus))
    if (!openApps.some(app => app.id === id) && openApps.length >= user.quotas.maxOpenApps) {
      throw new Error(`You can have at most ${user.quotas.maxOpenApps} open apps.`)
    }
  }
  const app = await orchestratorApplicationsClient.startApplication(id, input)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const stopApplicationAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:stop')) {
    throw new Error('You do not have permission to stop applications.')
  }
  const app = await orchestratorApplicationsClient.stopApplication(id)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const deleteApplicationAction = async (id: string, removeData = true) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:delete')) {
    throw new Error('You do not have permission to delete applications.')
  }
  const result = await orchestratorApplicationsClient.deleteApplication(id, removeData)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return result
}

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:update-apk')) {
    throw new Error('You do not have permission to update APKs.')
  }
  const app = await orchestratorApplicationsClient.updateApk(id, uploadedApkId)
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:configure-egress')) {
    throw new Error('You do not have permission to configure network access.')
  }
  if (
    user.role !== 'admin' &&
    input.networkPolicyAllowCidrs?.some(cidr => isBroadInternetCidr(cidr)) &&
    !hasPermission(user.permissions, 'applications:use-internet')
  ) {
    throw new Error('You do not have permission to allow broad internet access.')
  }
  const app = await orchestratorApplicationsClient.updateNetworkPolicy(id, input)
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const applyNetworkPolicyAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:configure-egress')) {
    throw new Error('You do not have permission to apply network policy.')
  }
  const app = await orchestratorApplicationsClient.applyNetworkPolicy(id)
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const switchApplicationProfileAction = async (id: string, input: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
    throw new Error('You do not have permission to switch profiles.')
  }
  const app = await orchestratorApplicationsClient.switchProfile(id, input)
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

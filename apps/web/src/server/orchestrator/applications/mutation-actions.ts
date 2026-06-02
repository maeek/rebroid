'use server'

import { cloneStoredAppIcon } from '@/server/app-icons/store'
import { recordAuditEvent } from '@/server/audit/events'
import { allowsBroadInternetAccess, hasPermission, isRedroidImage } from '@/shared/permissions/permissions'
import { applyRedroidDefaultContainerArgs } from '@/shared/runtime/redroid-runtime'
import { getCurrentOwnerUserId, getCurrentUserContext } from '../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../shared'
import { orchestratorApplicationsClient } from './client'
import { getApplicationAction } from './read-actions'
import { enforceResourceQuotas, enforceSessionQuota, sanitizeAndroidApplicationForUser } from './safety'
import type {
  CreateApplicationActionInput,
  ApplicationViewerControlCommand,
  SwitchApplicationProfileInput,
  UpdateAndroidApplicationInput,
  UpdateNetworkPolicyInput
} from './types'

const assertCanAccessApplication = async (id: string) => {
  await getApplicationAction(id)
}

const assertCanUseOwnedApplicationRuntime = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApplicationsClient.getApplication(id)
  if (app.ownerUserId !== user.ownerUserId) {
    throw new Error('Open this app as your own copy before starting or controlling its live session.')
  }
  return { app, user }
}

const assertCanOpenApplicationSlot = async (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>,
  candidateId?: string
) => {
  if (user.quotas.maxOpenApps === null) {
    return
  }

  const apps = await orchestratorApplicationsClient.listApplications(user.ownerUserId)
  const openApps = apps.filter(app => ['running', 'provisioning'].includes(app.status.currentStatus))
  const candidateIsAlreadyOpen = candidateId ? openApps.some(app => app.id === candidateId) : false

  if (!candidateIsAlreadyOpen && openApps.length >= user.quotas.maxOpenApps) {
    throw new Error(
      `Open app limit reached (${openApps.length}/${user.quotas.maxOpenApps}). Stop an app before starting another.`
    )
  }
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

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:start')) {
    throw new Error('You do not have permission to start applications.')
  }
  if (input && user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
    throw new Error('You do not have permission to switch profiles.')
  }
  await assertCanOpenApplicationSlot(user, id)
  const app = await orchestratorApplicationsClient.startApplication(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.start',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: input ? { profileMode: input.profileMode, profileName: input.profileName } : undefined
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const stopApplicationAction = async (id: string) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:stop')) {
    throw new Error('You do not have permission to stop applications.')
  }
  const app = await orchestratorApplicationsClient.stopApplication(id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.stop',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name
  })
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

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:configure-egress')) {
    throw new Error('You do not have permission to configure network access.')
  }
  if (
    user.role !== 'admin' &&
    (input.networkPolicyEnabled === false || allowsBroadInternetAccess(input.networkPolicyAllowCidrs ?? [])) &&
    !hasPermission(user.permissions, 'applications:use-internet')
  ) {
    throw new Error('You do not have permission to allow broad internet access.')
  }
  const app = await orchestratorApplicationsClient.updateNetworkPolicy(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.network.update',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: {
      networkPolicyEnabled: input.networkPolicyEnabled,
      allowCidrsCount: input.networkPolicyAllowCidrs?.length ?? 0
    }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const uploadApplicationDownloadFileAction = async (id: string, input: FormData) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:transfer-files')) {
    throw new Error('You do not have permission to transfer files.')
  }
  const result = await orchestratorApplicationsClient.uploadDownloadFile(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.file.upload',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { path: result.path, name: result.name, sizeBytes: result.sizeBytes }
  })
  return result
}

export const setApplicationClipboardAction = async (id: string, text: string) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:sync-clipboard')) {
    throw new Error('You do not have permission to sync clipboard.')
  }
  const result = await orchestratorApplicationsClient.setClipboard(id, text)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.clipboard.write',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { length: text.length }
  })
  return result
}

export const sendApplicationViewerControlAction = async (id: string, command: ApplicationViewerControlCommand) => {
  const { app, user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:control-viewer')) {
    throw new Error('You do not have permission to control this viewer.')
  }
  const result = await orchestratorApplicationsClient.sendViewerControl(id, command)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.viewer.control',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { command }
  })
  return result
}

export const applyNetworkPolicyAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:configure-egress')) {
    throw new Error('You do not have permission to apply network policy.')
  }
  const app = await orchestratorApplicationsClient.applyNetworkPolicy(id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.network.apply',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name
  })
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const reconcileNetworkPoliciesAction = async () => {
  const user = await getCurrentUserContext()
  if (user.role !== 'admin') {
    throw new Error('You do not have permission to reconcile all network policies.')
  }
  const result = await orchestratorApplicationsClient.reconcileNetworkPolicies()
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.network.reconcile',
    resourceType: 'network_policy'
  })
  return result
}

export const switchApplicationProfileAction = async (id: string, input: SwitchApplicationProfileInput) => {
  const { user } = await assertCanUseOwnedApplicationRuntime(id)
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:switch-profile')) {
    throw new Error('You do not have permission to switch profiles.')
  }
  const app = await orchestratorApplicationsClient.switchProfile(id, input)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.profile.switch',
    resourceType: 'application',
    resourceId: id,
    resourceLabel: app.name,
    details: { profileMode: input.profileMode, profileName: input.profileName }
  })
  revalidateApplicationDetail(id)
  return sanitizeAndroidApplicationForUser(app, user)
}

export const cloneApplicationForCurrentUserAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const user = await getCurrentUserContext()
  if (user.role !== 'admin' && !hasPermission(user.permissions, 'applications:create')) {
    throw new Error('You do not have permission to create applications.')
  }

  await assertCanOpenApplicationSlot(user)
  const app = await orchestratorApplicationsClient.cloneApplication(id, {
    ownerUserId: user.ownerUserId
  })
  await cloneStoredAppIcon(id, app.id)
  recordAuditEvent({
    actorUserId: user.ownerUserId,
    actorLabel: user.ownerUserId,
    category: 'application',
    action: 'application.clone',
    resourceType: 'application',
    resourceId: app.id,
    resourceLabel: app.name,
    details: { sourceApplicationId: id }
  })
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  revalidateApplicationDetail(app.id)
  return sanitizeAndroidApplicationForUser(app, user)
}

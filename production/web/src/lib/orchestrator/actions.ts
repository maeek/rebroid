'use server'

import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorApi } from './client'
import { getCurrentOwnerUserId, getCurrentUserContext } from './current-owner'
import type {
  CreateAndroidApplicationInput,
  SwitchApplicationProfileInput,
  UpdateAndroidApplicationInput,
  UpdateNetworkPolicyInput
} from './types'
import type { RuntimeUiSettings } from './ui-settings'

type CreateApplicationActionInput = Omit<CreateAndroidApplicationInput, 'ownerUserId'>

const requireUser = async () => {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error('Authentication required.')
  }
}

const assertCanAccessApplication = async (id: string) => {
  await getApplicationAction(id)
}

export const updateApplicationAction = async (id: string, input: UpdateAndroidApplicationInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.updateApplication(id, input)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const createApplicationAction = async (input: CreateApplicationActionInput) => {
  const ownerUserId = await getCurrentOwnerUserId()
  const app = await orchestratorApi.createApplication({ ...input, ownerUserId })
  revalidatePath('/apps')
  return app
}

export const listApplicationsAction = async () => {
  const user = await getCurrentUserContext()
  const ownerUserId = user.role === 'admin' ? undefined : user.ownerUserId
  return orchestratorApi.listApplications(ownerUserId)
}

export const getApplicationAction = async (id: string) => {
  const user = await getCurrentUserContext()
  const app = await orchestratorApi.getApplication(id)
  if (user.role !== 'admin' && app.ownerUserId !== user.ownerUserId) {
    throw new Error('Application not found.')
  }
  return app
}

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.startApplication(id, input)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const stopApplicationAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.stopApplication(id)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const deleteApplicationAction = async (id: string, removeData = true) => {
  await assertCanAccessApplication(id)
  const result = await orchestratorApi.deleteApplication(id, removeData)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return result
}

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.updateApk(id, uploadedApkId)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.updateNetworkPolicy(id, input)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const applyNetworkPolicyAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.applyNetworkPolicy(id)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const switchApplicationProfileAction = async (id: string, input: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApi.switchProfile(id, input)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const getAndroidNotificationsAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApi.getNotifications(id)
}

export const getApplicationLogsAction = async (id: string, source: 'container' | 'adb', tail = 300) => {
  await assertCanAccessApplication(id)
  return orchestratorApi.getApplicationLogs(id, source, tail)
}

export const getScrcpySessionAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApi.getScrcpySession(id)
}

export const recordViewerActivityAction = async (id: string) => {
  await assertCanAccessApplication(id)
  return orchestratorApi.recordViewerActivity(id)
}

export const getOrchestratorHealthAction = async () => {
  await requireUser()
  return orchestratorApi.health()
}

export const repairScrcpySidecarAction = async () => {
  await requireAdmin()
  return orchestratorApi.repairScrcpySidecar()
}

export const getSystemResourcesAction = async (refreshVolumes = false) => {
  await requireAdmin()
  return orchestratorApi.getSystemResources(refreshVolumes)
}

export const pruneImagesAction = async (danglingOnly = true) => {
  await requireAdmin()
  const result = await orchestratorApi.pruneImages(danglingOnly)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneContainersAction = async () => {
  await requireAdmin()
  const result = await orchestratorApi.pruneContainers()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneNetworksAction = async () => {
  await requireAdmin()
  const result = await orchestratorApi.pruneNetworks()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneVolumesAction = async () => {
  await requireAdmin()
  const result = await orchestratorApi.pruneVolumes()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneAllDockerResourcesAction = async () => {
  await requireAdmin()
  const result = await orchestratorApi.pruneAllDockerResources()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const listPlatformContainersAction = async () => {
  await requireAdmin()
  return orchestratorApi.listPlatformContainers()
}

export const getPlatformContainerAction = async (id: string) => {
  await requireAdmin()
  return orchestratorApi.getPlatformContainer(id)
}

export const getPlatformContainerLogsAction = async (id: string, tail = 500) => {
  await requireAdmin()
  return orchestratorApi.getPlatformContainerLogs(id, tail)
}

export const listPlatformImagesAction = async () => {
  await requireAdmin()
  return orchestratorApi.listPlatformImages()
}

export const getPlatformImageAction = async (id: string) => {
  await requireAdmin()
  return orchestratorApi.getPlatformImage(id)
}

export const removePlatformImageAction = async (id: string, force = false) => {
  await requireAdmin()
  const result = await orchestratorApi.removePlatformImage(id, force)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const listPlatformNetworksAction = async () => {
  await requireAdmin()
  return orchestratorApi.listPlatformNetworks()
}

export const getPlatformNetworkAction = async (id: string) => {
  await requireAdmin()
  return orchestratorApi.getPlatformNetwork(id)
}

export const removePlatformNetworkAction = async (id: string) => {
  await requireAdmin()
  const result = await orchestratorApi.removePlatformNetwork(id)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const stopPlatformContainerAction = async (id: string) => {
  await requireAdmin()
  const result = await orchestratorApi.stopPlatformContainer(id)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const removePlatformContainerAction = async (id: string) => {
  await requireAdmin()
  const result = await orchestratorApi.removePlatformContainer(id)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const cleanupUploadedApksAction = async () => {
  const ownerUserId = await getCurrentOwnerUserId()
  const result = await orchestratorApi.cleanupUploadedApks(ownerUserId)
  revalidatePath('/settings/orchestrator')
  return result
}

export const getOrchestratorSettingsAction = async () => {
  await requireAdmin()
  return orchestratorApi.getSettings()
}

export const updateOrchestratorSettingsAction = async (input: RuntimeUiSettings) => {
  await requireAdmin()
  return orchestratorApi.updateSettings(input)
}

export const resetOrchestratorSettingsAction = async () => {
  await requireAdmin()
  return orchestratorApi.resetSettings()
}

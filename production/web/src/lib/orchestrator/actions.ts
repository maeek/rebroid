'use server'

import { revalidatePath } from 'next/cache'
import { getServerAuthSession } from '@/server/auth/auth'
import { orchestratorApi } from './client'
import { getCurrentOwnerUserId } from './current-owner'
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

export const updateApplicationAction = async (id: string, input: UpdateAndroidApplicationInput) => {
  await requireUser()
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
  const ownerUserId = await getCurrentOwnerUserId()
  return orchestratorApi.listApplications(ownerUserId)
}

export const getApplicationAction = async (id: string) => {
  await requireUser()
  return orchestratorApi.getApplication(id)
}

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  await requireUser()
  const app = await orchestratorApi.startApplication(id, input)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const stopApplicationAction = async (id: string) => {
  await requireUser()
  const app = await orchestratorApi.stopApplication(id)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const deleteApplicationAction = async (id: string, removeData = true) => {
  await requireUser()
  const result = await orchestratorApi.deleteApplication(id, removeData)
  revalidatePath('/apps')
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return result
}

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await requireUser()
  const app = await orchestratorApi.updateApk(id, uploadedApkId)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) => {
  await requireUser()
  const app = await orchestratorApi.updateNetworkPolicy(id, input)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const applyNetworkPolicyAction = async (id: string) => {
  await requireUser()
  const app = await orchestratorApi.applyNetworkPolicy(id)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const switchApplicationProfileAction = async (id: string, input: SwitchApplicationProfileInput) => {
  await requireUser()
  const app = await orchestratorApi.switchProfile(id, input)
  revalidatePath(`/app/${id}`)
  revalidatePath(`/app/${id}/manage`)
  return app
}

export const getAndroidNotificationsAction = async (id: string) => {
  await requireUser()
  return orchestratorApi.getNotifications(id)
}

export const getSystemResourcesAction = async (refreshVolumes = false) => {
  await requireUser()
  return orchestratorApi.getSystemResources(refreshVolumes)
}

export const pruneImagesAction = async (danglingOnly = true) => {
  await requireUser()
  const result = await orchestratorApi.pruneImages(danglingOnly)
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneContainersAction = async () => {
  await requireUser()
  const result = await orchestratorApi.pruneContainers()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneNetworksAction = async () => {
  await requireUser()
  const result = await orchestratorApi.pruneNetworks()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneVolumesAction = async () => {
  await requireUser()
  const result = await orchestratorApi.pruneVolumes()
  revalidatePath('/settings/orchestrator')
  revalidatePath('/settings/system')
  return result
}

export const pruneAllDockerResourcesAction = async () => {
  await requireUser()
  const result = await orchestratorApi.pruneAllDockerResources()
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
  await requireUser()
  return orchestratorApi.getSettings()
}

export const updateOrchestratorSettingsAction = async (input: RuntimeUiSettings) => {
  await requireUser()
  return orchestratorApi.updateSettings(input)
}

export const resetOrchestratorSettingsAction = async () => {
  await requireUser()
  return orchestratorApi.resetSettings()
}

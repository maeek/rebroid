'use server'

import { getCurrentOwnerUserId } from '../current-user'
import { revalidateApplicationDetail, revalidateApplicationList } from '../shared'
import { orchestratorApplicationsClient } from './client'
import { getApplicationAction } from './read-actions'
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
  const app = await orchestratorApplicationsClient.updateApplication(id, input)
  revalidateApplicationDetail(id)
  return app
}

export const createApplicationAction = async (input: CreateApplicationActionInput) => {
  const ownerUserId = await getCurrentOwnerUserId()
  const app = await orchestratorApplicationsClient.createApplication({ ...input, ownerUserId })
  revalidateApplicationList()
  return app
}

export const startApplicationAction = async (id: string, input?: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.startApplication(id, input)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return app
}

export const stopApplicationAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.stopApplication(id)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return app
}

export const deleteApplicationAction = async (id: string, removeData = true) => {
  await assertCanAccessApplication(id)
  const result = await orchestratorApplicationsClient.deleteApplication(id, removeData)
  revalidateApplicationList()
  revalidateApplicationDetail(id)
  return result
}

export const updateApkAction = async (id: string, uploadedApkId: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.updateApk(id, uploadedApkId)
  revalidateApplicationDetail(id)
  return app
}

export const updateNetworkPolicyAction = async (id: string, input: UpdateNetworkPolicyInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.updateNetworkPolicy(id, input)
  revalidateApplicationDetail(id)
  return app
}

export const applyNetworkPolicyAction = async (id: string) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.applyNetworkPolicy(id)
  revalidateApplicationDetail(id)
  return app
}

export const switchApplicationProfileAction = async (id: string, input: SwitchApplicationProfileInput) => {
  await assertCanAccessApplication(id)
  const app = await orchestratorApplicationsClient.switchProfile(id, input)
  revalidateApplicationDetail(id)
  return app
}

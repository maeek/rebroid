'use server'

import { getCurrentOwnerUserId } from '../current-user'
import { requireAdminUser, revalidateOrchestratorSettingsPage } from '../shared'
import { orchestratorSettingsClient } from './client'
import type { RuntimeUiSettings } from '@/lib/orchestrator/ui-settings'

export const cleanupUploadedApksAction = async () => {
  const ownerUserId = await getCurrentOwnerUserId()
  const result = await orchestratorSettingsClient.cleanupUploadedApks(ownerUserId)
  revalidateOrchestratorSettingsPage()
  return result
}

export const getOrchestratorSettingsAction = async () => {
  await requireAdminUser()
  return orchestratorSettingsClient.getSettings()
}

export const updateOrchestratorSettingsAction = async (input: RuntimeUiSettings) => {
  await requireAdminUser()
  return orchestratorSettingsClient.updateSettings(input)
}

export const resetOrchestratorSettingsAction = async () => {
  await requireAdminUser()
  return orchestratorSettingsClient.resetSettings()
}

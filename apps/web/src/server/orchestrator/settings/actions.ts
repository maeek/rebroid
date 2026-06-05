'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentOwnerUserId } from '../current-user'
import { requireAdminUser, revalidateOrchestratorSettingsPage } from '../shared'
import { orchestratorSettingsClient } from './client'
import type { AutomationAiProvider, AutomationAiProviderModel } from './types'
import type { RuntimeUiSettings } from '@/features/settings/domain/orchestrator-ui-settings'

export const cleanupUploadedApksAction = async () => {
  const ownerUserId = await getCurrentOwnerUserId()
  const result = await orchestratorSettingsClient.cleanupUploadedApks(ownerUserId)
  recordAuditEvent({
    actorUserId: ownerUserId,
    actorLabel: ownerUserId,
    category: 'apk',
    action: 'apk.cleanup',
    resourceType: 'apk',
    details: result
  })
  revalidateOrchestratorSettingsPage()
  return result
}

export const getOrchestratorSettingsAction = async () => {
  await requireAdminUser()
  return orchestratorSettingsClient.getSettings()
}

export const updateOrchestratorSettingsAction = async (input: RuntimeUiSettings) => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.updateSettings(input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.orchestrator.update',
    resourceType: 'orchestrator_settings'
  })
  return result
}

export const resetOrchestratorSettingsAction = async () => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.resetSettings()
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.orchestrator.reset',
    resourceType: 'orchestrator_settings'
  })
  return result
}

export const listAutomationAiProvidersAction = async () => {
  await requireAdminUser()
  return orchestratorSettingsClient.listAiProviders()
}

export const createAutomationAiProviderAction = async (input: AutomationAiProvider) => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.createAiProvider(input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider.create',
    resourceType: 'ai_provider',
    resourceId: result.id
  })
  revalidateOrchestratorSettingsPage()
  return result
}

export const updateAutomationAiProviderAction = async (providerId: string, input: Partial<AutomationAiProvider>) => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.updateAiProvider(providerId, input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider.update',
    resourceType: 'ai_provider',
    resourceId: result.id
  })
  revalidateOrchestratorSettingsPage()
  return result
}

export const deleteAutomationAiProviderAction = async (providerId: string) => {
  const admin = await requireAdminUser()
  await orchestratorSettingsClient.deleteAiProvider(providerId)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider.delete',
    resourceType: 'ai_provider',
    resourceId: providerId
  })
  revalidateOrchestratorSettingsPage()
}

export const checkAutomationAiProviderHealthAction = async (providerId: string, modelId?: string) =>
  orchestratorSettingsClient.checkAiProviderHealth(providerId, modelId)

export const createAutomationAiProviderModelAction = async (providerId: string, input: AutomationAiProviderModel) => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.createAiProviderModel(providerId, input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider_model.create',
    resourceType: 'ai_provider',
    resourceId: providerId,
    details: { modelId: result.id }
  })
  revalidateOrchestratorSettingsPage()
  return result
}

export const updateAutomationAiProviderModelAction = async (
  providerId: string,
  modelId: string,
  input: Partial<AutomationAiProviderModel>
) => {
  const admin = await requireAdminUser()
  const result = await orchestratorSettingsClient.updateAiProviderModel(providerId, modelId, input)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider_model.update',
    resourceType: 'ai_provider',
    resourceId: providerId,
    details: { modelId: result.id }
  })
  revalidateOrchestratorSettingsPage()
  return result
}

export const deleteAutomationAiProviderModelAction = async (providerId: string, modelId: string) => {
  const admin = await requireAdminUser()
  await orchestratorSettingsClient.deleteAiProviderModel(providerId, modelId)
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: admin.name || admin.username || admin.id,
    category: 'settings',
    action: 'settings.ai_provider_model.delete',
    resourceType: 'ai_provider',
    resourceId: providerId,
    details: { modelId }
  })
  revalidateOrchestratorSettingsPage()
}

export const listAutomationAiModelCatalogAction = async () => orchestratorSettingsClient.listAiModelCatalog()

'use server'

import { recordAuditEvent } from '@/server/audit/events'
import { getCurrentOwnerUserId } from '../current-user'
import { requireAdminUser, revalidateOrchestratorSettingsPage } from '../shared'
import { orchestratorSettingsClient } from './client'
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

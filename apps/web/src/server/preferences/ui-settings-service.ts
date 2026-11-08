import 'server-only'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin, getCurrentUser } from '@/server/auth/authorization'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { getWebSettings, resetWebSettings, saveWebSettings } from '@/server/web-settings/store'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'
import type {
  AiUiSettings,
  GeneralUiSettings,
  OrchestratorUiSettings,
  RuntimeUiSettingsPatch
} from '@/shared/model/settings/orchestrator-ui-settings'

const adminLabel = (admin: Awaited<ReturnType<typeof requireAdmin>>) => admin.name || admin.username || admin.id

const combinedSettings = async (): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([
    getWebSettings().catch(() => defaultWebSettingsResponse),
    orchestratorSettingsClient.getSettings().catch(() => defaultRuntimeSettingsResponse)
  ])
  return normalizeOrchestratorUiSettings(web, orchestrator, getOrchestratorBaseUrl())
}

export const readUiSettings = async () => {
  const [user, settings] = await Promise.all([getCurrentUser(), combinedSettings()])
  if (user.role === 'admin') return settings

  return {
    ...settings,
    orchestratorApiUrl: '',
    dockerImageRegistry: null,
    auditRetentionDays: defaultWebSettingsResponse.auditRetentionDays,
    passwordMinimumLength: defaultWebSettingsResponse.passwordMinimumLength,
    services: {
      ocr: { ...settings.services.ocr, endpoint: null },
      firewall: { ...settings.services.firewall, endpoint: null }
    }
  }
}

const recordUpdate = (admin: Awaited<ReturnType<typeof requireAdmin>>, scope: string) =>
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: adminLabel(admin),
    category: 'settings',
    action: `settings.${scope}.update`,
    resourceType: 'ui_settings'
  })

export const saveGeneralUiSettings = async (settings: GeneralUiSettings) => {
  const admin = await requireAdmin()
  await saveWebSettings(settings)
  recordUpdate(admin, 'general')
  return combinedSettings()
}

export const resetGeneralUiSettings = async () => {
  const admin = await requireAdmin()
  await resetWebSettings()
  recordUpdate(admin, 'general_reset')
  return combinedSettings()
}

export const saveAiUiSettings = async (settings: AiUiSettings) => {
  const admin = await requireAdmin()
  await saveWebSettings(settings)
  recordUpdate(admin, 'ai')
  return combinedSettings()
}

export const saveRuntimeUiSettings = async (settings: RuntimeUiSettingsPatch) => {
  const admin = await requireAdmin()
  const { removeDataOnDelete, ...runtimeSettings } = settings
  if (Object.keys(runtimeSettings).length > 0) {
    await orchestratorSettingsClient.updateSettings(runtimeSettings)
  }
  if (removeDataOnDelete !== undefined) await saveWebSettings({ removeDataOnDelete })
  recordUpdate(admin, 'runtime')
  return combinedSettings()
}

export const resetRuntimeUiSettings = async () => {
  const admin = await requireAdmin()
  await orchestratorSettingsClient.resetSettings()
  recordUpdate(admin, 'runtime_reset')
  return combinedSettings()
}

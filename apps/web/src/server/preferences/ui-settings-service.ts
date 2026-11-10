import 'server-only'
import { recordAuditEvent } from '@/server/audit/events'
import { requireAdmin, getCurrentUser } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getOrchestratorBaseUrl } from '@/server/orchestrator/config'
import { orchestratorSettingsClient } from '@/server/orchestrator/settings/client'
import { getWebSettings, resetWebSettings, saveWebSettings } from '@/server/web-settings/store'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'
import type { OrchestratorSettingsResponse, WebSettingsResponse } from '@/shared/contracts/ui-settings'
import type {
  AiUiSettings,
  GeneralUiSettings,
  RuntimeUiSettingsPatch
} from '@/shared/model/settings/orchestrator-ui-settings'

const adminLabel = (admin: Awaited<ReturnType<typeof requireAdmin>>) => admin.name || admin.username || admin.id

const readOptionalRuntimeSettings = () =>
  orchestratorSettingsClient.getSettings().catch(() => defaultRuntimeSettingsResponse)

const combineSettings = (web: WebSettingsResponse, orchestrator: OrchestratorSettingsResponse) =>
  normalizeOrchestratorUiSettings(web, orchestrator, getOrchestratorBaseUrl())

export const readUiSettings = async () => {
  const [user, web, orchestrator] = await Promise.all([
    getCurrentUser(),
    getWebSettings().catch(() => defaultWebSettingsResponse),
    readOptionalRuntimeSettings()
  ])
  const settings = combineSettings(web, orchestrator)
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

const recordUpdate = (
  admin: Awaited<ReturnType<typeof requireAdmin>>,
  scope: string,
  failureDetails?: Record<string, unknown>
) =>
  recordAuditEvent({
    actorUserId: admin.id,
    actorLabel: adminLabel(admin),
    category: 'settings',
    action: `settings.${scope}.update`,
    resourceType: 'ui_settings',
    ...(failureDetails ? { outcome: 'failure', details: failureDetails } : {})
  })

export const saveGeneralUiSettings = async (settings: GeneralUiSettings) => {
  const admin = await requireAdmin()
  const web = await saveWebSettings(settings)
  recordUpdate(admin, 'general')
  return combineSettings(web, await readOptionalRuntimeSettings())
}

export const resetGeneralUiSettings = async () => {
  const admin = await requireAdmin()
  const web = await resetWebSettings()
  recordUpdate(admin, 'general_reset')
  return combineSettings(web, await readOptionalRuntimeSettings())
}

export const saveAiUiSettings = async (settings: AiUiSettings) => {
  const admin = await requireAdmin()
  const web = await saveWebSettings(settings)
  recordUpdate(admin, 'ai')
  return combineSettings(web, await readOptionalRuntimeSettings())
}

export const saveRuntimeUiSettings = async (settings: RuntimeUiSettingsPatch) => {
  const admin = await requireAdmin()
  const { removeDataOnDelete, ...runtimeSettings } = settings
  const changesRuntime = Object.keys(runtimeSettings).length > 0
  let web = await getWebSettings()
  const orchestrator = changesRuntime
    ? await orchestratorSettingsClient.updateSettings(runtimeSettings)
    : await orchestratorSettingsClient.getSettings()
  if (removeDataOnDelete !== undefined) {
    try {
      web = await saveWebSettings({ removeDataOnDelete })
    } catch (error) {
      if (!changesRuntime) throw error
      recordUpdate(admin, 'runtime', { runtimeSettingsSaved: true, deletionPolicySaved: false })
      throw new PublicActionError(
        'Runtime settings were saved. The app data deletion policy could not be saved. Try saving again.',
        { code: 'internal', status: 500 }
      )
    }
  }
  recordUpdate(admin, 'runtime')
  return combineSettings(web, orchestrator)
}

export const resetRuntimeUiSettings = async () => {
  const admin = await requireAdmin()
  const web = await getWebSettings()
  const orchestrator = await orchestratorSettingsClient.resetSettings()
  recordUpdate(admin, 'runtime_reset')
  return combineSettings(web, orchestrator)
}

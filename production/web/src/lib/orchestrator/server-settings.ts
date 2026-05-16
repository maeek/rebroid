import { getWebSettings } from '@/lib/web-settings/store'
import { orchestratorApi } from './client'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from './ui-settings'
import type { OrchestratorUiSettings } from './ui-settings'

export const getServerOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const [webSettings, orchestratorSettings] = await Promise.all([
    getWebSettings().catch(() => defaultWebSettingsResponse),
    orchestratorApi.getSettings().catch(() => defaultRuntimeSettingsResponse)
  ])

  return normalizeOrchestratorUiSettings(webSettings, orchestratorSettings)
}

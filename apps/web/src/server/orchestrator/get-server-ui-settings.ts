import { cache } from 'react'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from '@/features/settings/domain/orchestrator-ui-settings'
import { getWebSettings } from '@/server/web-settings/store'
import { getOrchestratorBaseUrl } from './config'
import { orchestratorSettingsClient } from './settings/client'
import type { OrchestratorUiSettings } from '@/features/settings/domain/orchestrator-ui-settings'

export const getServerOrchestratorUiSettings = cache(async (): Promise<OrchestratorUiSettings> => {
  const [webSettings, orchestratorSettings] = await Promise.all([
    getWebSettings().catch(() => defaultWebSettingsResponse),
    orchestratorSettingsClient.getSettings().catch(() => defaultRuntimeSettingsResponse)
  ])

  return normalizeOrchestratorUiSettings(webSettings, orchestratorSettings, getOrchestratorBaseUrl())
})

import { cache } from 'react'
import { connection } from 'next/server'
import { getWebSettings } from '@/server/web-settings/store'
import {
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from '@/shared/model/settings/orchestrator-ui-settings'
import { getOrchestratorBaseUrl } from './config'
import { orchestratorSettingsClient } from './settings/client'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const getServerOrchestratorUiSettings = cache(async (): Promise<OrchestratorUiSettings> => {
  await connection()

  const [webSettings, orchestratorSettings] = await Promise.all([
    getWebSettings().catch(() => defaultWebSettingsResponse),
    orchestratorSettingsClient.getSettings().catch(() => defaultRuntimeSettingsResponse)
  ])

  return normalizeOrchestratorUiSettings(webSettings, orchestratorSettings, getOrchestratorBaseUrl())
})

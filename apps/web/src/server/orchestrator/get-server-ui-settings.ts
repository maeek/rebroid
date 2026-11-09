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

const loadServerUiSettings = async (required: boolean): Promise<OrchestratorUiSettings> => {
  await connection()

  const [webSettings, orchestratorSettings] = await Promise.all([
    getWebSettings().catch(error => {
      if (required) throw error
      return defaultWebSettingsResponse
    }),
    orchestratorSettingsClient.getSettings().catch(error => {
      if (required) throw error
      return defaultRuntimeSettingsResponse
    })
  ])

  return normalizeOrchestratorUiSettings(webSettings, orchestratorSettings, getOrchestratorBaseUrl())
}

export const getServerOrchestratorUiSettings = cache(() => loadServerUiSettings(false))
export const getRequiredServerOrchestratorUiSettings = cache(() => loadServerUiSettings(true))

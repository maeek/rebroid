import { cache } from 'react'
import { connection } from 'next/server'
import 'server-only'
import { getCurrentUser } from '@/server/auth/authorization'
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
  const user = await getCurrentUser()

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

  const settings = normalizeOrchestratorUiSettings(webSettings, orchestratorSettings, getOrchestratorBaseUrl())
  if (user.isPlatformAdmin) return settings

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

export const getServerOrchestratorUiSettings = cache(() => loadServerUiSettings(false))
export const getRequiredServerOrchestratorUiSettings = cache(() => loadServerUiSettings(true))

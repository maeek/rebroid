'use client'

import { useEffect, useState } from 'react'
import { sendBff } from '@/lib/http/bff'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import type {
  AiUiSettings,
  GeneralUiSettings,
  OrchestratorUiSettings,
  RuntimeUiSettingsPatch
} from '@/shared/model/settings/orchestrator-ui-settings'

const maxApkCookieName = 'rebroid_max_apk_size_mb'

const writeUploadLimitCookie = (settings: OrchestratorUiSettings) => {
  document.cookie = `${maxApkCookieName}=${settings.maxApkUploadSizeMb}; path=/; max-age=31536000; SameSite=Lax`
}

const dispatchSettingsUpdated = (settings: OrchestratorUiSettings) => {
  window.dispatchEvent(new CustomEvent('orchestrator-settings-updated', { detail: settings }))
}

const applySettings = (settings: OrchestratorUiSettings) => {
  writeUploadLimitCookie(settings)
  dispatchSettingsUpdated(settings)
  return settings
}

const persistSettings = async (body: unknown) =>
  applySettings(await sendBff<OrchestratorUiSettings>('/api/bff/preferences/ui-settings', body))

export const saveGeneralUiSettings = async (settings: GeneralUiSettings): Promise<OrchestratorUiSettings> => {
  return persistSettings({ operation: 'save-general', settings })
}

export const resetGeneralUiSettings = async (): Promise<OrchestratorUiSettings> => {
  return persistSettings({ operation: 'reset-general' })
}

export const saveAiUiSettings = async (settings: AiUiSettings): Promise<OrchestratorUiSettings> => {
  return persistSettings({ operation: 'save-ai', settings })
}

export const saveOrchestratorUiSettings = async (settings: RuntimeUiSettingsPatch): Promise<OrchestratorUiSettings> => {
  return persistSettings({ operation: 'save-runtime', settings })
}

export const resetOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  return persistSettings({ operation: 'reset-runtime' })
}

export const useOrchestratorUiSettings = (initialSettings = defaultOrchestratorUiSettings) => {
  const [settings, setSettings] = useState(initialSettings)

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  useEffect(() => {
    const onSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<OrchestratorUiSettings>
      const nextSettings = customEvent.detail ?? defaultOrchestratorUiSettings
      setSettings(nextSettings)
    }

    window.addEventListener('orchestrator-settings-updated', onSettingsUpdated)
    return () => window.removeEventListener('orchestrator-settings-updated', onSettingsUpdated)
  }, [])

  return settings
}

export const apkSizeLabel = (sizeMb: number) => `${sizeMb} MB`

export const isFileWithinApkLimit = (file: File, maxApkUploadSizeMb: number) =>
  file.size <= maxApkUploadSizeMb * 1024 * 1024

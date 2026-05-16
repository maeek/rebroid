'use client'

import { useEffect, useState } from 'react'
import { getWebSettingsAction, resetWebSettingsAction, saveWebSettingsAction } from '../web-settings/actions'
import {
  getOrchestratorSettingsAction,
  resetOrchestratorSettingsAction,
  updateOrchestratorSettingsAction
} from './actions'
import {
  defaultOrchestratorUiSettings,
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from './ui-settings'
import type {
  GeneralUiSettings,
  OrchestratorSettingsResponse,
  OrchestratorUiSettings,
  RuntimeUiSettings,
  WebSettingsResponse
} from './ui-settings'

export { defaultOrchestratorUiSettings } from './ui-settings'
export type {
  GeneralUiSettings,
  OrchestratorSettingsResponse,
  OrchestratorUiSettings,
  RuntimeUiSettings,
  WebSettingsResponse
} from './ui-settings'

const maxApkCookieName = 'sma_max_apk_size_mb'

const writeUploadLimitCookie = (settings: OrchestratorUiSettings) => {
  document.cookie = `${maxApkCookieName}=${settings.maxApkUploadSizeMb}; path=/; max-age=31536000; SameSite=Lax`
}

const dispatchSettingsUpdated = (settings: OrchestratorUiSettings) => {
  window.dispatchEvent(new CustomEvent('orchestrator-settings-updated', { detail: settings }))
}

const loadWebSettings = async (): Promise<WebSettingsResponse> =>
  getWebSettingsAction().catch(() => defaultWebSettingsResponse)

const loadRuntimeSettings = async (): Promise<OrchestratorSettingsResponse> =>
  getOrchestratorSettingsAction().catch(() => defaultRuntimeSettingsResponse)

const mergeSettings = (web: Partial<WebSettingsResponse>, orchestrator: Partial<OrchestratorSettingsResponse>) => {
  const settings = normalizeOrchestratorUiSettings(web, orchestrator)
  writeUploadLimitCookie(settings)
  return settings
}

export const getOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([loadWebSettings(), loadRuntimeSettings()])
  return mergeSettings(web, orchestrator)
}

export const saveGeneralUiSettings = async (settings: GeneralUiSettings): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([saveWebSettingsAction(settings), loadRuntimeSettings()])

  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const resetGeneralUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([resetWebSettingsAction(), loadRuntimeSettings()])

  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const saveOrchestratorUiSettings = async (settings: RuntimeUiSettings): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([
    loadWebSettings(),
    updateOrchestratorSettingsAction({
      defaultRedroidImage: settings.defaultRedroidImage,
      defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
      maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
      imagePruneIntervalHours: settings.imagePruneIntervalHours,
      imagePruneDanglingOnly: settings.imagePruneDanglingOnly
    })
  ])

  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const resetOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const [web, orchestrator] = await Promise.all([loadWebSettings(), resetOrchestratorSettingsAction()])

  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const useOrchestratorUiSettings = (
  initialSettings?: OrchestratorUiSettings,
  options?: { refreshOnMount?: boolean }
) => {
  const [settings, setSettings] = useState(initialSettings ?? defaultOrchestratorUiSettings)
  const shouldRefreshOnMount = options?.refreshOnMount ?? initialSettings === undefined

  useEffect(() => {
    setSettings(initialSettings ?? defaultOrchestratorUiSettings)
  }, [initialSettings])

  useEffect(() => {
    if (shouldRefreshOnMount) {
      void getOrchestratorUiSettings().then(setSettings)
    }

    const onSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<OrchestratorUiSettings>
      setSettings(customEvent.detail ?? defaultOrchestratorUiSettings)
    }

    window.addEventListener('orchestrator-settings-updated', onSettingsUpdated)
    return () => window.removeEventListener('orchestrator-settings-updated', onSettingsUpdated)
  }, [shouldRefreshOnMount])

  return settings
}

export const apkSizeLabel = (sizeMb: number) => `${sizeMb} MB`

export const isFileWithinApkLimit = (file: File, maxApkUploadSizeMb: number) =>
  file.size <= maxApkUploadSizeMb * 1024 * 1024

'use client'

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */

import { useEffect, useState } from 'react'
import type {
  GeneralUiSettings,
  OrchestratorUiSettings,
  RuntimeUiSettings
} from '@/features/settings/domain/orchestrator-ui-settings'
import type { OrchestratorSettingsResponse } from '@/server/orchestrator/settings/types'
import type { WebSettings as WebSettingsResponse } from '@/server/web-settings/types'
import {
  defaultOrchestratorUiSettings,
  defaultRuntimeSettingsResponse,
  defaultWebSettingsResponse,
  normalizeOrchestratorUiSettings
} from '@/features/settings/domain/orchestrator-ui-settings'
import {
  getOrchestratorSettingsAction,
  resetOrchestratorSettingsAction,
  updateOrchestratorSettingsAction
} from '@/server/orchestrator/settings/actions'
import { getWebSettingsAction } from '@/server/web-settings/actions/get-web-settings-action'
import { resetWebSettingsAction } from '@/server/web-settings/actions/reset-web-settings-action'
import { saveWebSettingsAction } from '@/server/web-settings/actions/save-web-settings-action'

export { defaultOrchestratorUiSettings } from '@/features/settings/domain/orchestrator-ui-settings'
export type {
  GeneralUiSettings,
  OrchestratorUiSettings,
  RuntimeUiSettings
} from '@/features/settings/domain/orchestrator-ui-settings'
export type { OrchestratorSettingsResponse } from '@/server/orchestrator/settings/types'
export type { WebSettings as WebSettingsResponse } from '@/server/web-settings/types'

const getWebSettings = getWebSettingsAction
const resetWebSettings = resetWebSettingsAction
const saveWebSettings = saveWebSettingsAction
const getOrchestratorSettings = getOrchestratorSettingsAction
const resetOrchestratorSettings = resetOrchestratorSettingsAction
const updateOrchestratorSettings = updateOrchestratorSettingsAction

const maxApkCookieName = 'rebroid_max_apk_size_mb'

const writeUploadLimitCookie = (settings: OrchestratorUiSettings) => {
  document.cookie = `${maxApkCookieName}=${settings.maxApkUploadSizeMb}; path=/; max-age=31536000; SameSite=Lax`
}

const dispatchSettingsUpdated = (settings: OrchestratorUiSettings) => {
  window.dispatchEvent(new CustomEvent('orchestrator-settings-updated', { detail: settings }))
}

const loadWebSettings = async (): Promise<WebSettingsResponse> => {
  try {
    return await getWebSettings()
  } catch {
    return defaultWebSettingsResponse
  }
}

const saveGeneralWebSettings = async (settings: GeneralUiSettings): Promise<WebSettingsResponse> =>
  await saveWebSettings(settings)

const resetGeneralWebSettings = async (): Promise<WebSettingsResponse> => await resetWebSettings()

const loadRuntimeSettings = async (): Promise<OrchestratorSettingsResponse> => {
  try {
    return await getOrchestratorSettings()
  } catch {
    return defaultRuntimeSettingsResponse
  }
}

const saveRuntimeSettings = async (settings: RuntimeUiSettings): Promise<OrchestratorSettingsResponse> =>
  await updateOrchestratorSettings(settings)

const resetRuntimeSettings = async (): Promise<OrchestratorSettingsResponse> => await resetOrchestratorSettings()

const mergeSettings = (web: Partial<WebSettingsResponse>, orchestrator: Partial<OrchestratorSettingsResponse>) => {
  const settings = normalizeOrchestratorUiSettings(web, orchestrator)
  writeUploadLimitCookie(settings)
  return settings
}

export const getOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const web = await loadWebSettings()
  const orchestrator = await loadRuntimeSettings()
  return mergeSettings(web, orchestrator)
}

export const saveGeneralUiSettings = async (settings: GeneralUiSettings): Promise<OrchestratorUiSettings> => {
  const web = await saveGeneralWebSettings(settings)
  const orchestrator = await loadRuntimeSettings()
  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const resetGeneralUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const web = await resetGeneralWebSettings()
  const orchestrator = await loadRuntimeSettings()
  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const saveOrchestratorUiSettings = async (settings: RuntimeUiSettings): Promise<OrchestratorUiSettings> => {
  const web = await loadWebSettings()
  const orchestrator = await saveRuntimeSettings({
    defaultContainerImage: settings.defaultContainerImage,
    dockerImageRegistry: settings.dockerImageRegistry,
    defaultInactivityTimeoutSeconds: settings.defaultInactivityTimeoutSeconds,
    maxApkUploadSizeMb: settings.maxApkUploadSizeMb,
    imagePruneIntervalHours: settings.imagePruneIntervalHours,
    imagePruneDanglingOnly: settings.imagePruneDanglingOnly
  })
  const saved = mergeSettings(web, orchestrator)
  dispatchSettingsUpdated(saved)
  return saved
}

export const resetOrchestratorUiSettings = async (): Promise<OrchestratorUiSettings> => {
  const web = await loadWebSettings()
  const orchestrator = await resetRuntimeSettings()
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
      void getOrchestratorUiSettings().then(nextSettings => setSettings(nextSettings))
    }

    const onSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<OrchestratorUiSettings>
      const nextSettings = customEvent.detail ?? defaultOrchestratorUiSettings
      setSettings(nextSettings)
    }

    window.addEventListener('orchestrator-settings-updated', onSettingsUpdated)
    return () => window.removeEventListener('orchestrator-settings-updated', onSettingsUpdated)
  }, [shouldRefreshOnMount])

  return settings
}

export const apkSizeLabel = (sizeMb: number) => `${sizeMb} MB`

export const isFileWithinApkLimit = (file: File, maxApkUploadSizeMb: number) =>
  file.size <= maxApkUploadSizeMb * 1024 * 1024

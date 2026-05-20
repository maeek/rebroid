import type { ScrcpyTransport } from '@/server/orchestrator/applications/types'
import type { OrchestratorSettingsResponse } from '@/server/orchestrator/settings/types'
import type { WebSettings as WebSettingsResponse } from '@/server/web-settings/types'

export interface OrchestratorUiSettings {
  defaultContainerImage: string
  dockerImageRegistry: string | null
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  imagePruneIntervalHours: number
  imagePruneDanglingOnly: boolean
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
  scrcpyTransport: ScrcpyTransport
}

export type GeneralUiSettings = Pick<OrchestratorUiSettings, 'appListRefreshIntervalSeconds' | 'removeDataOnDelete'>

export type RuntimeUiSettings = Pick<
  OrchestratorUiSettings,
  | 'defaultContainerImage'
  | 'dockerImageRegistry'
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'imagePruneIntervalHours'
  | 'imagePruneDanglingOnly'
>

export const defaultOrchestratorUiSettings: OrchestratorUiSettings = {
  defaultContainerImage: 'redroid/redroid:13.0.0-latest',
  dockerImageRegistry: null,
  defaultInactivityTimeoutSeconds: 900,
  maxApkUploadSizeMb: 512,
  imagePruneIntervalHours: 24,
  imagePruneDanglingOnly: true,
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true,
  scrcpyTransport: 'websocket'
}

export const defaultWebSettingsResponse: WebSettingsResponse = {
  appListRefreshIntervalSeconds: defaultOrchestratorUiSettings.appListRefreshIntervalSeconds,
  removeDataOnDelete: defaultOrchestratorUiSettings.removeDataOnDelete
}

export const defaultRuntimeSettingsResponse: OrchestratorSettingsResponse = {
  defaultContainerImage: defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultScrcpyTransport: defaultOrchestratorUiSettings.scrcpyTransport,
  defaultInactivityTimeoutSeconds: defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: defaultOrchestratorUiSettings.maxApkUploadSizeMb,
  imagePruneIntervalHours: defaultOrchestratorUiSettings.imagePruneIntervalHours,
  imagePruneDanglingOnly: defaultOrchestratorUiSettings.imagePruneDanglingOnly
}

export const normalizeOrchestratorUiSettings = (
  web: Partial<WebSettingsResponse>,
  orchestrator: Partial<OrchestratorSettingsResponse>
): OrchestratorUiSettings => ({
  appListRefreshIntervalSeconds:
    Number(web.appListRefreshIntervalSeconds) || defaultOrchestratorUiSettings.appListRefreshIntervalSeconds,
  removeDataOnDelete:
    typeof web.removeDataOnDelete === 'boolean'
      ? web.removeDataOnDelete
      : defaultOrchestratorUiSettings.removeDataOnDelete,
  defaultContainerImage:
    orchestrator.defaultContainerImage?.trim() || defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: orchestrator.dockerImageRegistry?.trim() || defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds:
    Number(orchestrator.defaultInactivityTimeoutSeconds) ||
    defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: Number(orchestrator.maxApkUploadSizeMb) || defaultOrchestratorUiSettings.maxApkUploadSizeMb,
  imagePruneIntervalHours:
    Number(orchestrator.imagePruneIntervalHours) || defaultOrchestratorUiSettings.imagePruneIntervalHours,
  imagePruneDanglingOnly:
    typeof orchestrator.imagePruneDanglingOnly === 'boolean'
      ? orchestrator.imagePruneDanglingOnly
      : defaultOrchestratorUiSettings.imagePruneDanglingOnly,
  scrcpyTransport: 'websocket'
})

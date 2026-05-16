import { ScrcpyTransport } from './types'

export interface OrchestratorUiSettings {
  defaultContainerImage: string
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
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'imagePruneIntervalHours'
  | 'imagePruneDanglingOnly'
>

export interface WebSettingsResponse {
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
}

export interface OrchestratorSettingsResponse {
  defaultContainerImage: string
  defaultScrcpyTransport: ScrcpyTransport
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  imagePruneIntervalHours: number
  imagePruneDanglingOnly: boolean
}

export const defaultOrchestratorUiSettings: OrchestratorUiSettings = {
  defaultContainerImage: 'redroid/redroid:13.0.0-latest',
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

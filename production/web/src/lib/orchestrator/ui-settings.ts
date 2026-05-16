import { ORCHESTRATOR_OWNER_USER_ID, ScrcpyTransport } from './types'

export interface OrchestratorUiSettings {
  ownerUserId: string
  defaultRedroidImage: string
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  imagePruneIntervalHours: number
  imagePruneDanglingOnly: boolean
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
  scrcpyTransport: ScrcpyTransport
}

export type GeneralUiSettings = Pick<
  OrchestratorUiSettings,
  'ownerUserId' | 'appListRefreshIntervalSeconds' | 'removeDataOnDelete'
>

export type RuntimeUiSettings = Pick<
  OrchestratorUiSettings,
  | 'defaultRedroidImage'
  | 'defaultInactivityTimeoutSeconds'
  | 'maxApkUploadSizeMb'
  | 'imagePruneIntervalHours'
  | 'imagePruneDanglingOnly'
>

export interface WebSettingsResponse {
  ownerUserId: string
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
}

export interface OrchestratorSettingsResponse {
  defaultRedroidImage: string
  defaultScrcpyTransport: ScrcpyTransport
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  imagePruneIntervalHours: number
  imagePruneDanglingOnly: boolean
}

export const defaultOrchestratorUiSettings: OrchestratorUiSettings = {
  ownerUserId: ORCHESTRATOR_OWNER_USER_ID,
  defaultRedroidImage: 'redroid/redroid:13.0.0-latest',
  defaultInactivityTimeoutSeconds: 900,
  maxApkUploadSizeMb: 512,
  imagePruneIntervalHours: 24,
  imagePruneDanglingOnly: true,
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true,
  scrcpyTransport: 'websocket'
}

export const defaultWebSettingsResponse: WebSettingsResponse = {
  ownerUserId: defaultOrchestratorUiSettings.ownerUserId,
  appListRefreshIntervalSeconds: defaultOrchestratorUiSettings.appListRefreshIntervalSeconds,
  removeDataOnDelete: defaultOrchestratorUiSettings.removeDataOnDelete
}

export const defaultRuntimeSettingsResponse: OrchestratorSettingsResponse = {
  defaultRedroidImage: defaultOrchestratorUiSettings.defaultRedroidImage,
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
  ownerUserId: web.ownerUserId?.trim() || defaultOrchestratorUiSettings.ownerUserId,
  appListRefreshIntervalSeconds:
    Number(web.appListRefreshIntervalSeconds) || defaultOrchestratorUiSettings.appListRefreshIntervalSeconds,
  removeDataOnDelete:
    typeof web.removeDataOnDelete === 'boolean'
      ? web.removeDataOnDelete
      : defaultOrchestratorUiSettings.removeDataOnDelete,
  defaultRedroidImage: orchestrator.defaultRedroidImage?.trim() || defaultOrchestratorUiSettings.defaultRedroidImage,
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

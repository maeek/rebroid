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
  defaultViewerPreset: 'bandwidth' | 'balanced' | 'quality'
  defaultViewerBitrateMbps: number
  defaultViewerMaxFps: number
  defaultViewerMaxSize: number
  defaultViewerIFrameInterval: number
  defaultViewerKeyboardCaptureEnabled: boolean
  defaultViewerSoundEnabled: boolean
}

export type GeneralUiSettings = Pick<
  OrchestratorUiSettings,
  | 'appListRefreshIntervalSeconds'
  | 'removeDataOnDelete'
  | 'defaultViewerPreset'
  | 'defaultViewerBitrateMbps'
  | 'defaultViewerMaxFps'
  | 'defaultViewerMaxSize'
  | 'defaultViewerIFrameInterval'
  | 'defaultViewerKeyboardCaptureEnabled'
  | 'defaultViewerSoundEnabled'
>

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
  scrcpyTransport: 'webrtc',
  defaultViewerPreset: 'balanced',
  defaultViewerBitrateMbps: 3,
  defaultViewerMaxFps: 30,
  defaultViewerMaxSize: 1080,
  defaultViewerIFrameInterval: 1,
  defaultViewerKeyboardCaptureEnabled: false,
  defaultViewerSoundEnabled: true
}

export const defaultWebSettingsResponse: WebSettingsResponse = {
  appListRefreshIntervalSeconds: defaultOrchestratorUiSettings.appListRefreshIntervalSeconds,
  removeDataOnDelete: defaultOrchestratorUiSettings.removeDataOnDelete,
  defaultViewerPreset: defaultOrchestratorUiSettings.defaultViewerPreset,
  defaultViewerBitrateMbps: defaultOrchestratorUiSettings.defaultViewerBitrateMbps,
  defaultViewerMaxFps: defaultOrchestratorUiSettings.defaultViewerMaxFps,
  defaultViewerMaxSize: defaultOrchestratorUiSettings.defaultViewerMaxSize,
  defaultViewerIFrameInterval: defaultOrchestratorUiSettings.defaultViewerIFrameInterval,
  defaultViewerKeyboardCaptureEnabled: defaultOrchestratorUiSettings.defaultViewerKeyboardCaptureEnabled,
  defaultViewerSoundEnabled: defaultOrchestratorUiSettings.defaultViewerSoundEnabled
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
  defaultViewerPreset:
    web.defaultViewerPreset === 'bandwidth' ||
    web.defaultViewerPreset === 'quality' ||
    web.defaultViewerPreset === 'balanced'
      ? web.defaultViewerPreset
      : defaultOrchestratorUiSettings.defaultViewerPreset,
  defaultViewerBitrateMbps:
    Number(web.defaultViewerBitrateMbps) || defaultOrchestratorUiSettings.defaultViewerBitrateMbps,
  defaultViewerMaxFps: Number(web.defaultViewerMaxFps) || defaultOrchestratorUiSettings.defaultViewerMaxFps,
  defaultViewerMaxSize:
    typeof web.defaultViewerMaxSize === 'number'
      ? web.defaultViewerMaxSize
      : defaultOrchestratorUiSettings.defaultViewerMaxSize,
  defaultViewerIFrameInterval:
    Number(web.defaultViewerIFrameInterval) || defaultOrchestratorUiSettings.defaultViewerIFrameInterval,
  defaultViewerKeyboardCaptureEnabled:
    typeof web.defaultViewerKeyboardCaptureEnabled === 'boolean'
      ? web.defaultViewerKeyboardCaptureEnabled
      : defaultOrchestratorUiSettings.defaultViewerKeyboardCaptureEnabled,
  defaultViewerSoundEnabled:
    typeof web.defaultViewerSoundEnabled === 'boolean'
      ? web.defaultViewerSoundEnabled
      : defaultOrchestratorUiSettings.defaultViewerSoundEnabled,
  defaultContainerImage:
    orchestrator.defaultContainerImage?.trim() || defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: orchestrator.dockerImageRegistry?.trim() || defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds:
    typeof orchestrator.defaultInactivityTimeoutSeconds === 'number'
      ? orchestrator.defaultInactivityTimeoutSeconds
      : defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: Number(orchestrator.maxApkUploadSizeMb) || defaultOrchestratorUiSettings.maxApkUploadSizeMb,
  imagePruneIntervalHours:
    Number(orchestrator.imagePruneIntervalHours) || defaultOrchestratorUiSettings.imagePruneIntervalHours,
  imagePruneDanglingOnly:
    typeof orchestrator.imagePruneDanglingOnly === 'boolean'
      ? orchestrator.imagePruneDanglingOnly
      : defaultOrchestratorUiSettings.imagePruneDanglingOnly,
  scrcpyTransport:
    orchestrator.defaultScrcpyTransport === 'websocket' || orchestrator.defaultScrcpyTransport === 'webrtc'
      ? orchestrator.defaultScrcpyTransport
      : defaultOrchestratorUiSettings.scrcpyTransport
})

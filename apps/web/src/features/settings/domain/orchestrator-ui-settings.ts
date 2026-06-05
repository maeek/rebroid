import type { ScrcpyTransport } from '@/server/orchestrator/applications/types'
import type { OrchestratorSettingsResponse } from '@/server/orchestrator/settings/types'
import type { WebSettings as WebSettingsResponse } from '@/server/web-settings/types'

export interface OrchestratorUiSettings {
  orchestratorApiUrl: string
  defaultContainerImage: string
  dockerImageRegistry: string | null
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
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
  auditRetentionDays: number
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
  'defaultContainerImage' | 'dockerImageRegistry' | 'defaultInactivityTimeoutSeconds' | 'maxApkUploadSizeMb'
>

export const defaultOrchestratorUiSettings: OrchestratorUiSettings = {
  orchestratorApiUrl: 'http://localhost:4100',
  defaultContainerImage: 'redroid/redroid:13.0.0-latest',
  dockerImageRegistry: null,
  defaultInactivityTimeoutSeconds: 900,
  maxApkUploadSizeMb: 512,
  appListRefreshIntervalSeconds: 5,
  removeDataOnDelete: true,
  scrcpyTransport: 'webrtc',
  defaultViewerPreset: 'balanced',
  defaultViewerBitrateMbps: 3,
  defaultViewerMaxFps: 30,
  defaultViewerMaxSize: 1080,
  defaultViewerIFrameInterval: 1,
  defaultViewerKeyboardCaptureEnabled: false,
  defaultViewerSoundEnabled: true,
  auditRetentionDays: 30
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
  defaultViewerSoundEnabled: defaultOrchestratorUiSettings.defaultViewerSoundEnabled,
  auditRetentionDays: defaultOrchestratorUiSettings.auditRetentionDays
}

export const defaultRuntimeSettingsResponse: OrchestratorSettingsResponse = {
  defaultContainerImage: defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultScrcpyTransport: defaultOrchestratorUiSettings.scrcpyTransport,
  defaultInactivityTimeoutSeconds: defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: defaultOrchestratorUiSettings.maxApkUploadSizeMb
}

export const normalizeOrchestratorUiSettings = (
  web: Partial<WebSettingsResponse>,
  orchestrator: Partial<OrchestratorSettingsResponse>,
  orchestratorApiUrl = defaultOrchestratorUiSettings.orchestratorApiUrl
): OrchestratorUiSettings => ({
  orchestratorApiUrl,
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
  auditRetentionDays:
    typeof web.auditRetentionDays === 'number'
      ? web.auditRetentionDays
      : defaultOrchestratorUiSettings.auditRetentionDays,
  defaultContainerImage:
    orchestrator.defaultContainerImage?.trim() || defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: orchestrator.dockerImageRegistry?.trim() || defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultInactivityTimeoutSeconds:
    typeof orchestrator.defaultInactivityTimeoutSeconds === 'number'
      ? orchestrator.defaultInactivityTimeoutSeconds
      : defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: Number(orchestrator.maxApkUploadSizeMb) || defaultOrchestratorUiSettings.maxApkUploadSizeMb,
  scrcpyTransport:
    orchestrator.defaultScrcpyTransport === 'websocket' || orchestrator.defaultScrcpyTransport === 'webrtc'
      ? orchestrator.defaultScrcpyTransport
      : defaultOrchestratorUiSettings.scrcpyTransport
})

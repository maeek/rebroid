import type { ScrcpyTransport } from '@/shared/contracts/application'
import type { OrchestratorSettingsResponse, WebSettingsResponse } from '@/shared/contracts/ui-settings'
import type { ViewerStreamingPreset } from '@/shared/model/settings/viewer-streaming-preset'

export interface OrchestratorUiSettings {
  orchestratorApiUrl: string
  defaultContainerImage: string
  dockerImageRegistry: string | null
  defaultInactivityTimeoutSeconds: number
  maxApkUploadSizeMb: number
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
  scrcpyTransport: ScrcpyTransport
  defaultViewerPreset: ViewerStreamingPreset
  defaultViewerBitrateMbps: number
  defaultViewerMaxFps: number
  defaultViewerMaxSize: number
  defaultViewerIFrameInterval: number
  defaultViewerKeyboardCaptureEnabled: boolean
  defaultViewerSoundEnabled: boolean
  aiContextualSuggestionsEnabled: boolean
  auditRetentionDays: number
  passwordMinimumLength: number
  services: OptionalServicesUiSettings
}

export interface OptionalServiceUiSettings {
  enabled: boolean
  endpoint: string | null
  timeoutMs: number
}

export interface OcrServiceUiSettings extends OptionalServiceUiSettings {
  maxImageDimension: number
  minConfidence: number
  languages: string[]
  preprocessingModes: string[]
}

export interface OptionalServicesUiSettings {
  ocr: OcrServiceUiSettings
  firewall: OptionalServiceUiSettings
}

export type GeneralUiSettings = Pick<
  OrchestratorUiSettings,
  | 'appListRefreshIntervalSeconds'
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
  | 'services'
>

export type RuntimeAdminUiSettings = RuntimeUiSettings & Pick<OrchestratorUiSettings, 'removeDataOnDelete'>

export type AiUiSettings = Pick<OrchestratorUiSettings, 'aiContextualSuggestionsEnabled'>

export const defaultOrchestratorUiSettings: OrchestratorUiSettings = {
  orchestratorApiUrl: 'http://localhost:4100',
  defaultContainerImage: 'redroid/redroid:14.0.0-latest',
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
  aiContextualSuggestionsEnabled: true,
  auditRetentionDays: 30,
  passwordMinimumLength: 8,
  services: {
    ocr: {
      enabled: true,
      endpoint: null,
      timeoutMs: 15000,
      maxImageDimension: 1600,
      minConfidence: 0.4,
      languages: ['en'],
      preprocessingModes: ['raw', 'grayscale', 'contrast', 'threshold']
    },
    firewall: {
      enabled: true,
      endpoint: '/run/rebroid-firewall/agent.sock',
      timeoutMs: 5000
    }
  }
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
  aiContextualSuggestionsEnabled: defaultOrchestratorUiSettings.aiContextualSuggestionsEnabled,
  auditRetentionDays: defaultOrchestratorUiSettings.auditRetentionDays,
  passwordMinimumLength: defaultOrchestratorUiSettings.passwordMinimumLength
}

export const defaultRuntimeSettingsResponse: OrchestratorSettingsResponse = {
  defaultContainerImage: defaultOrchestratorUiSettings.defaultContainerImage,
  dockerImageRegistry: defaultOrchestratorUiSettings.dockerImageRegistry,
  defaultScrcpyTransport: defaultOrchestratorUiSettings.scrcpyTransport,
  defaultInactivityTimeoutSeconds: defaultOrchestratorUiSettings.defaultInactivityTimeoutSeconds,
  maxApkUploadSizeMb: defaultOrchestratorUiSettings.maxApkUploadSizeMb,
  services: defaultOrchestratorUiSettings.services
}

const normalizeEndpoint = (value: unknown) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const normalizeStringList = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback
  const normalized = value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(item => item.length > 0)
  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback
}

const normalizeServices = (value: Partial<OrchestratorSettingsResponse['services']> | undefined) => {
  const defaults = defaultOrchestratorUiSettings.services
  const ocr = value?.ocr
  const firewall = value?.firewall
  return {
    ocr: {
      enabled: typeof ocr?.enabled === 'boolean' ? ocr.enabled : defaults.ocr.enabled,
      endpoint: normalizeEndpoint(ocr?.endpoint) ?? defaults.ocr.endpoint,
      timeoutMs: Number(ocr?.timeoutMs) || defaults.ocr.timeoutMs,
      maxImageDimension: Number(ocr?.maxImageDimension) || defaults.ocr.maxImageDimension,
      minConfidence: typeof ocr?.minConfidence === 'number' ? ocr.minConfidence : defaults.ocr.minConfidence,
      languages: normalizeStringList(ocr?.languages, defaults.ocr.languages),
      preprocessingModes: normalizeStringList(ocr?.preprocessingModes, defaults.ocr.preprocessingModes)
    },
    firewall: {
      enabled: typeof firewall?.enabled === 'boolean' ? firewall.enabled : defaults.firewall.enabled,
      endpoint: normalizeEndpoint(firewall?.endpoint) ?? defaults.firewall.endpoint,
      timeoutMs: Number(firewall?.timeoutMs) || defaults.firewall.timeoutMs
    }
  }
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
    web.defaultViewerPreset === 'low-latency' ||
    web.defaultViewerPreset === 'balanced' ||
    web.defaultViewerPreset === 'high-quality' ||
    web.defaultViewerPreset === 'bandwidth-saver'
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
  aiContextualSuggestionsEnabled:
    typeof web.aiContextualSuggestionsEnabled === 'boolean'
      ? web.aiContextualSuggestionsEnabled
      : defaultOrchestratorUiSettings.aiContextualSuggestionsEnabled,
  auditRetentionDays:
    typeof web.auditRetentionDays === 'number'
      ? web.auditRetentionDays
      : defaultOrchestratorUiSettings.auditRetentionDays,
  passwordMinimumLength:
    typeof web.passwordMinimumLength === 'number'
      ? web.passwordMinimumLength
      : defaultOrchestratorUiSettings.passwordMinimumLength,
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
      : defaultOrchestratorUiSettings.scrcpyTransport,
  services: normalizeServices(orchestrator.services)
})

import type { ViewerStreamingPreset } from '@/shared/model/settings/viewer-streaming-preset'
import type { OrchestratorApiSchemas } from '@rebroid/orchestrator-client'

export type OrchestratorSettingsResponse = OrchestratorApiSchemas['OrchestratorSettingsDto']

export interface WebSettingsResponse {
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
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
}

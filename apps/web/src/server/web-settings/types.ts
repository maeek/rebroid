import type { ViewerStreamingPreset } from '@/shared/model/settings/viewer-streaming-preset'

export interface WebSettings {
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

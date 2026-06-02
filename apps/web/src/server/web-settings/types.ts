export interface WebSettings {
  appListRefreshIntervalSeconds: number
  removeDataOnDelete: boolean
  defaultViewerPreset: 'bandwidth' | 'balanced' | 'quality'
  defaultViewerBitrateMbps: number
  defaultViewerMaxFps: number
  defaultViewerMaxSize: number
  defaultViewerIFrameInterval: number
  defaultViewerKeyboardCaptureEnabled: boolean
  defaultViewerSoundEnabled: boolean
  auditRetentionDays: number
}

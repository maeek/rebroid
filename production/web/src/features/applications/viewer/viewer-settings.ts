export type ViewerStreamingPreset = 'balanced' | 'bandwidth' | 'quality'
export type ViewerPlayer = 'webcodecs'

export type ViewerPlayerDefinition = {
  value: ViewerPlayer
  label: string
  description: string
}

export const viewerPlayerDefinitions: ViewerPlayerDefinition[] = [
  {
    value: 'webcodecs',
    label: 'WebCodecs',
    description: 'Low-latency live display playback. Best tested in Chromium-based browsers.'
  }
]

export const isViewerPlayer = (value: unknown): value is ViewerPlayer =>
  typeof value === 'string' && viewerPlayerDefinitions.some(player => player.value === value)

export type ViewerStreamingSettings = {
  player: ViewerPlayer
  preset: ViewerStreamingPreset
  bitrateMbps: number
  maxFps: number
  maxSize: number
  iFrameInterval: number
  fitToFrame: boolean
}

export type ViewerSettings = ViewerStreamingSettings & {
  keyboardCaptureEnabled: boolean
  soundEnabled: boolean
}

export const viewerStreamingPresets: Record<ViewerStreamingPreset, ViewerStreamingSettings> = {
  bandwidth: {
    player: 'webcodecs',
    preset: 'bandwidth',
    bitrateMbps: 1.5,
    maxFps: 24,
    maxSize: 1080,
    iFrameInterval: 1,
    fitToFrame: false
  },
  balanced: {
    player: 'webcodecs',
    preset: 'balanced',
    bitrateMbps: 3,
    maxFps: 30,
    maxSize: 1080,
    iFrameInterval: 1,
    fitToFrame: false
  },
  quality: {
    player: 'webcodecs',
    preset: 'quality',
    bitrateMbps: 7,
    maxFps: 30,
    maxSize: 1080,
    iFrameInterval: 1,
    fitToFrame: false
  }
}

export const defaultViewerSettings: ViewerSettings = {
  ...viewerStreamingPresets.balanced,
  keyboardCaptureEnabled: false,
  soundEnabled: true
}

const storageKey = 'rebroid.viewer.settings.v5'

const isValidNumber = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(Math.max(value, min), max)
}

export const normalizeViewerSettings = (value: Partial<ViewerSettings> | null | undefined): ViewerSettings => ({
  keyboardCaptureEnabled:
    typeof value?.keyboardCaptureEnabled === 'boolean'
      ? value.keyboardCaptureEnabled
      : defaultViewerSettings.keyboardCaptureEnabled,
  soundEnabled: typeof value?.soundEnabled === 'boolean' ? value.soundEnabled : defaultViewerSettings.soundEnabled,
  player: isViewerPlayer(value?.player) ? value.player : defaultViewerSettings.player,
  preset:
    value?.preset && Object.hasOwn(viewerStreamingPresets, value.preset) ? value.preset : defaultViewerSettings.preset,
  bitrateMbps: isValidNumber(value?.bitrateMbps, defaultViewerSettings.bitrateMbps, 1, 32),
  maxFps: isValidNumber(value?.maxFps, defaultViewerSettings.maxFps, 1, 120),
  maxSize: value?.maxSize === 0 ? 0 : isValidNumber(value?.maxSize, defaultViewerSettings.maxSize, 1080, 4096),
  iFrameInterval: isValidNumber(value?.iFrameInterval, defaultViewerSettings.iFrameInterval, 1, 30),
  fitToFrame: typeof value?.fitToFrame === 'boolean' ? value.fitToFrame : defaultViewerSettings.fitToFrame
})

export const loadViewerSettings = () => {
  if (typeof window === 'undefined') {
    return defaultViewerSettings
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : null

    if (!parsed || typeof parsed !== 'object') {
      return normalizeViewerSettings(null)
    }

    return normalizeViewerSettings(parsed)
  } catch {
    return defaultViewerSettings
  }
}

export const saveViewerSettings = (settings: ViewerSettings) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(settings))
}

export const viewerSettingsFromDefaults = (settings: {
  defaultViewerPreset: ViewerStreamingPreset
  defaultViewerBitrateMbps: number
  defaultViewerMaxFps: number
  defaultViewerMaxSize: number
  defaultViewerIFrameInterval: number
  defaultViewerKeyboardCaptureEnabled: boolean
  defaultViewerSoundEnabled: boolean
}): ViewerSettings =>
  normalizeViewerSettings({
    ...viewerStreamingPresets[settings.defaultViewerPreset],
    preset: settings.defaultViewerPreset,
    bitrateMbps: settings.defaultViewerBitrateMbps,
    maxFps: settings.defaultViewerMaxFps,
    maxSize: settings.defaultViewerMaxSize,
    iFrameInterval: settings.defaultViewerIFrameInterval,
    fitToFrame: settings.defaultViewerMaxSize === 0,
    keyboardCaptureEnabled: settings.defaultViewerKeyboardCaptureEnabled,
    soundEnabled: settings.defaultViewerSoundEnabled
  })

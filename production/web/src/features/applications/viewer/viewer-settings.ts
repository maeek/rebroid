export type ViewerStreamingPreset = 'balanced' | 'bandwidth' | 'quality'
export type ViewerPlayer = 'mse' | 'broadway' | 'tinyh264' | 'webcodecs'

export type ViewerPlayerDefinition = {
  value: ViewerPlayer
  label: string
  description: string
}

export const viewerPlayerDefinitions: ViewerPlayerDefinition[] = [
  {
    value: 'mse',
    label: 'MSE',
    description: 'Media Source Extensions. Usually the most compatible option.'
  },
  {
    value: 'broadway',
    label: 'Broadway.js',
    description: 'WASM software decoder. Useful fallback when MSE has browser-specific issues.'
  },
  {
    value: 'tinyh264',
    label: 'Tiny H264',
    description: 'WASM worker decoder. Lower compatibility, useful as a fallback path.'
  },
  {
    value: 'webcodecs',
    label: 'WebCodecs',
    description: 'Browser decode path when supported. Best tested in Chromium-based browsers.'
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
  soundEnabled: boolean
}

export const viewerStreamingPresets: Record<ViewerStreamingPreset, ViewerStreamingSettings> = {
  bandwidth: {
    player: 'mse',
    preset: 'bandwidth',
    bitrateMbps: 3,
    maxFps: 30,
    maxSize: 720,
    iFrameInterval: 5,
    fitToFrame: false
  },
  balanced: {
    player: 'mse',
    preset: 'balanced',
    bitrateMbps: 7,
    maxFps: 60,
    maxSize: 1080,
    iFrameInterval: 10,
    fitToFrame: false
  },
  quality: {
    player: 'mse',
    preset: 'quality',
    bitrateMbps: 12,
    maxFps: 60,
    maxSize: 1440,
    iFrameInterval: 10,
    fitToFrame: false
  }
}

export const defaultViewerSettings: ViewerSettings = {
  ...viewerStreamingPresets.balanced,
  soundEnabled: true
}

const storageKey = 'rebroid.viewer.settings'

const isValidNumber = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(Math.max(value, min), max)
}

export const normalizeViewerSettings = (value: Partial<ViewerSettings> | null | undefined): ViewerSettings => ({
  soundEnabled: typeof value?.soundEnabled === 'boolean' ? value.soundEnabled : defaultViewerSettings.soundEnabled,
  player: isViewerPlayer(value?.player) ? value.player : defaultViewerSettings.player,
  preset:
    value?.preset && Object.hasOwn(viewerStreamingPresets, value.preset) ? value.preset : defaultViewerSettings.preset,
  bitrateMbps: isValidNumber(value?.bitrateMbps, defaultViewerSettings.bitrateMbps, 1, 32),
  maxFps: isValidNumber(value?.maxFps, defaultViewerSettings.maxFps, 1, 120),
  maxSize: isValidNumber(value?.maxSize, defaultViewerSettings.maxSize, 0, 4096),
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

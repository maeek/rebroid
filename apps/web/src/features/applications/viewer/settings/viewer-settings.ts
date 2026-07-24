import { viewerTransport, type ViewerTransport } from '@rebroid/android-application-core/viewer-control'
import type { ViewerStreamingPreset } from '@/shared/model/settings/viewer-streaming-preset'

export type { ViewerStreamingPreset } from '@/shared/model/settings/viewer-streaming-preset'
export type ViewerPlayer = 'webcodecs'

export type ViewerPlayerDefinition = {
  value: ViewerPlayer
  label: string
  description: string
}

export const viewerPlayerDefinitions: ViewerPlayerDefinition[] = [
  {
    value: 'webcodecs',
    label: 'Native low latency',
    description: 'WebRTC native video with optimized Chromium WebCodecs and Firefox MediaSource fallback.'
  }
]

export const isViewerPlayer = (value: unknown): value is ViewerPlayer =>
  typeof value === 'string' && viewerPlayerDefinitions.some(player => player.value === value)

export type ViewerStreamingSettings = {
  player: ViewerPlayer
  transport: ViewerTransport
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
  'low-latency': {
    player: 'webcodecs',
    transport: viewerTransport.WebRTC,
    preset: 'low-latency',
    bitrateMbps: 16,
    maxFps: 60,
    maxSize: 0,
    iFrameInterval: 1,
    fitToFrame: true
  },
  balanced: {
    player: 'webcodecs',
    transport: viewerTransport.WebRTC,
    preset: 'balanced',
    bitrateMbps: 3,
    maxFps: 60,
    maxSize: 0,
    iFrameInterval: 1,
    fitToFrame: false
  },
  'high-quality': {
    player: 'webcodecs',
    transport: viewerTransport.WebRTC,
    preset: 'high-quality',
    bitrateMbps: 16,
    maxFps: 60,
    maxSize: 0,
    iFrameInterval: 1,
    fitToFrame: true
  },
  'bandwidth-saver': {
    player: 'webcodecs',
    transport: viewerTransport.WebRTC,
    preset: 'bandwidth-saver',
    bitrateMbps: 1.5,
    maxFps: 60,
    maxSize: 0,
    iFrameInterval: 1,
    fitToFrame: false
  }
}

export const defaultViewerSettings: ViewerSettings = {
  ...viewerStreamingPresets['low-latency'],
  keyboardCaptureEnabled: false,
  soundEnabled: false
}

export const viewerSettingsStorageKey = 'rebroid.viewer.settings.v10'

const isViewerTransport = (value: unknown): value is ViewerTransport =>
  value === viewerTransport.WebRTC || value === viewerTransport.WebSocket

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
  transport: isViewerTransport(value?.transport) ? value.transport : defaultViewerSettings.transport,
  preset:
    value?.preset && Object.hasOwn(viewerStreamingPresets, value.preset) ? value.preset : defaultViewerSettings.preset,
  bitrateMbps: isValidNumber(value?.bitrateMbps, defaultViewerSettings.bitrateMbps, 1, 32),
  maxFps: 60,
  maxSize: 0,
  iFrameInterval: 1,
  fitToFrame: typeof value?.fitToFrame === 'boolean' ? value.fitToFrame : defaultViewerSettings.fitToFrame
})

export const loadViewerSettings = () => {
  if (typeof window === 'undefined') {
    return defaultViewerSettings
  }

  try {
    const raw = window.localStorage.getItem(viewerSettingsStorageKey)
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

  window.localStorage.setItem(viewerSettingsStorageKey, JSON.stringify(settings))
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

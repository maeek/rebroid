import { viewerPlayerDefinitions } from './viewer-settings'
import type { ViewerPlayer } from './viewer-settings'

export type ViewerPlayerCapability = {
  supported: boolean
  reason: string | null
}

export type ViewerPlayerCapabilities = Record<ViewerPlayer, ViewerPlayerCapability>

const canUseWebGl = () => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

export const getViewerPlayerCapabilities = (): ViewerPlayerCapabilities => {
  const unavailable: ViewerPlayerCapability = {
    supported: false,
    reason: 'Browser APIs are not available yet.'
  }

  if (typeof window === 'undefined') {
    return Object.fromEntries(viewerPlayerDefinitions.map(player => [player.value, unavailable])) as ViewerPlayerCapabilities
  }

  const hasMediaSource =
    typeof window.MediaSource !== 'undefined' &&
    window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
  const hasWasm = typeof window.WebAssembly === 'object' && typeof window.WebAssembly.instantiate === 'function'
  const hasWorker = typeof window.Worker !== 'undefined'
  const hasWebGl = canUseWebGl()
  const hasWebCodecs = typeof window.VideoDecoder !== 'undefined'

  return {
    mse: {
      supported: hasMediaSource,
      reason: hasMediaSource ? null : 'Media Source Extensions with H.264 are unavailable.'
    },
    broadway: {
      supported: hasWasm,
      reason: hasWasm ? (hasWebGl ? null : 'WebGL is unavailable; Broadway may fall back to canvas.') : 'WebAssembly is unavailable.'
    },
    tinyh264: {
      supported: hasWasm && hasWorker && hasWebGl,
      reason:
        hasWasm && hasWorker && hasWebGl
          ? null
          : 'Tiny H264 requires WebAssembly, Web Workers, and WebGL.'
    },
    webcodecs: {
      supported: hasWebCodecs,
      reason: hasWebCodecs ? null : 'WebCodecs is unavailable in this browser.'
    }
  }
}

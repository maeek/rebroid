import { viewerPlayerDefinitions } from '@/features/applications/viewer/settings/viewer-settings'
import type { ViewerPlayer } from '@/features/applications/viewer/settings/viewer-settings'

export type ViewerPlayerCapability = {
  supported: boolean
  reason: string | null
}

export type ViewerPlayerCapabilities = Record<ViewerPlayer, ViewerPlayerCapability>

export const getViewerPlayerCapabilities = (): ViewerPlayerCapabilities => {
  const unavailable: ViewerPlayerCapability = {
    supported: false,
    reason: 'Browser APIs are not available yet.'
  }

  if (typeof window === 'undefined') {
    return Object.fromEntries(
      viewerPlayerDefinitions.map(player => [player.value, unavailable])
    ) as ViewerPlayerCapabilities
  }

  const hasWebRtc = typeof window.RTCPeerConnection !== 'undefined'
  const hasWorkerMedia =
    typeof window.Worker !== 'undefined' &&
    typeof window.OffscreenCanvas !== 'undefined' &&
    (typeof window.VideoDecoder !== 'undefined' || typeof window.MediaSource !== 'undefined')
  const supported = hasWebRtc || hasWorkerMedia

  return {
    webcodecs: {
      supported,
      reason: supported ? null : 'WebRTC and worker-owned WebSocket media APIs are unavailable in this browser.'
    }
  }
}

import { viewerPlayerDefinitions } from './viewer-settings'
import type { ViewerPlayer } from './viewer-settings'

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

  const hasWebCodecs = typeof window.VideoDecoder !== 'undefined'

  return {
    webcodecs: {
      supported: hasWebCodecs,
      reason: hasWebCodecs ? null : 'WebCodecs is unavailable in this browser.'
    }
  }
}

import { describe, expect, it } from 'vitest'
import {
  isDisplayViewerStreamMetrics,
  isDisplayViewerStreamStatus,
  viewerStreamMetricsMessageType,
  viewerStreamStatusMessageType
} from './display-viewer-stream-status'

describe('display viewer stream status messages', () => {
  it('accepts a valid stream status message', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'audio-disabled',
        severity: 'info',
        blocking: false,
        message: 'Audio capture is disabled for this stream.',
        transport: 'websocket'
      })
    ).toBe(true)
  })

  it('rejects unknown status codes', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'other',
        severity: 'info',
        blocking: false,
        message: 'Unknown status'
      })
    ).toBe(false)
  })

  it('rejects malformed payloads', () => {
    expect(
      isDisplayViewerStreamStatus({
        type: viewerStreamStatusMessageType,
        code: 'reconnecting',
        severity: 'warning',
        blocking: 'no',
        message: 'Reconnecting live display...'
      })
    ).toBe(false)
  })
})

describe('display viewer stream metrics messages', () => {
  it('accepts presented-frame and transport diagnostics', () => {
    expect(
      isDisplayViewerStreamMetrics({
        type: viewerStreamMetricsMessageType,
        version: 4,
        transport: 'webrtc',
        receivedFps: 60,
        decodedFps: 59.8,
        drawnFps: 59.7,
        presentedFps: 59.7,
        wireBitrateMbps: 7.8,
        relayQueueDepthMs: 18,
        relayDroppedFrames: 2,
        freezeCount: 0,
        roundTripTimeMs: 4,
        packetsLost: 0,
        renderer: 'webrtc-video',
        effectiveProfile: {
          transport: 'webrtc',
          codec: 'h264',
          maxSize: 1080,
          maxFps: 60,
          bitrate: 8_000_000,
          iFrameInterval: 1,
          audio: true
        },
        collectedAt: Date.now()
      })
    ).toBe(true)
  })

  it('rejects the removed ambiguous fps metric', () => {
    expect(
      isDisplayViewerStreamMetrics({
        type: viewerStreamMetricsMessageType,
        version: 4,
        transport: 'websocket',
        fps: 60,
        collectedAt: Date.now()
      })
    ).toBe(false)
  })

  it('rejects the retired unversioned metrics contract', () => {
    expect(
      isDisplayViewerStreamMetrics({
        type: 'rebroid-viewer-stream-metrics',
        transport: 'websocket',
        presentedFps: 60,
        collectedAt: Date.now()
      })
    ).toBe(false)
  })
})

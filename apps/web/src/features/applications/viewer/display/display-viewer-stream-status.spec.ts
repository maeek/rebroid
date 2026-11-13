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

  it('requires a session ID on a session-expiry signal', () => {
    const status = {
      type: viewerStreamStatusMessageType,
      code: 'session-expired',
      severity: 'error',
      blocking: true,
      message: 'The display session ended.'
    }
    expect(isDisplayViewerStreamStatus(status)).toBe(false)
    expect(isDisplayViewerStreamStatus({ ...status, sessionId: 'fixture' })).toBe(true)
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

  it('validates correlated recovery and receiver metrics without accepting malformed counters', () => {
    const message = {
      type: viewerStreamMetricsMessageType,
      version: 4,
      transport: 'webrtc',
      renderer: 'webrtc-video',
      consumerAttemptId: 'consumer',
      sourceAttemptId: 'source',
      sourceCodecGeneration: 7,
      videoResetGeneration: 2,
      videoResetCompletedGeneration: 2,
      videoResetElapsedMs: 180,
      receivedFrames: 120,
      decodedFrames: 118,
      presentedFrames: 117,
      receiverPacketsLost: 3,
      receiverNackCount: 4,
      receiverPliCount: 2,
      frameAcknowledgement: 'sent',
      frameAcknowledgementsSent: 1,
      effectiveProfile: {
        transport: 'webrtc',
        codec: 'h264',
        maxSize: 1080,
        maxFps: 60,
        bitrate: 8_000_000,
        iFrameInterval: 1,
        audio: false
      },
      collectedAt: 1000
    }
    expect(isDisplayViewerStreamMetrics(message)).toBe(true)
    for (const field of [
      'sourceCodecGeneration',
      'videoResetGeneration',
      'videoResetCompletedGeneration',
      'videoResetElapsedMs',
      'receivedFrames',
      'decodedFrames',
      'presentedFrames',
      'receiverPacketsLost',
      'receiverNackCount',
      'receiverPliCount',
      'frameAcknowledgementsSent'
    ]) {
      expect(isDisplayViewerStreamMetrics({ ...message, [field]: Infinity })).toBe(false)
    }
    expect(isDisplayViewerStreamMetrics({ ...message, consumerAttemptId: 4 })).toBe(false)
    expect(isDisplayViewerStreamMetrics({ ...message, frameAcknowledgement: 'unknown' })).toBe(false)
    expect(isDisplayViewerStreamMetrics({ ...message, frameAcknowledgement: 'toString' })).toBe(false)
    const displaySizePresentation = {
      previous: { width: 1080, height: 2340 },
      current: { width: 2340, height: 1080 },
      elapsedMs: 45
    }
    expect(isDisplayViewerStreamMetrics({ ...message, displaySizePresentation })).toBe(true)
    for (const elapsedMs of [-1, Infinity, '45']) {
      expect(
        isDisplayViewerStreamMetrics({ ...message, displaySizePresentation: { ...displaySizePresentation, elapsedMs } })
      ).toBe(false)
    }
    expect(
      isDisplayViewerStreamMetrics({
        ...message,
        displaySizePresentation: { ...displaySizePresentation, current: { width: 0, height: 1 } }
      })
    ).toBe(false)
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

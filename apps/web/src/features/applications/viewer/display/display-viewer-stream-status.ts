export const viewerStreamStatusMessageType = 'rebroid-viewer-stream-status'
export const viewerStreamMetricsMessageType = 'rebroid-viewer-stream-metrics-v4'

export type DisplayViewerStreamStatusCode =
  'audio-disabled' | 'reconnecting' | 'first-frame-timeout' | 'video-stalled' | 'stream-error'

export type DisplayViewerStreamStatusSeverity = 'info' | 'warning' | 'error'

export type DisplayViewerStreamStatus = {
  code: DisplayViewerStreamStatusCode
  severity: DisplayViewerStreamStatusSeverity
  blocking: boolean
  message: string
  transport?: 'webrtc' | 'websocket'
}

export type DisplayViewerStreamMetrics = {
  version: 4
  transport: 'webrtc' | 'websocket'
  sourceFps?: number
  relayIngressFps?: number
  bridgeInputFps?: number
  rtpSentFps?: number
  receivedFps?: number
  decodedFps?: number
  drawnFps?: number
  presentedFps?: number
  wireBitrateMbps?: number
  sourceBitrateMbps?: number
  sourceFrameSizeP95Bytes?: number
  keyFrameSizeBytes?: number
  frameGapP50Ms?: number
  frameGapP95Ms?: number
  frameGapP99Ms?: number
  frameGapMaxMs?: number
  sourceInterFrameP95Ms?: number
  networkInterArrivalJitterP95Ms?: number
  decodeP95Ms?: number
  decodeToDrawP95Ms?: number
  liveEdgeAgeP95Ms?: number
  relayQueueDepthMs?: number
  relayP95Ms?: number
  relayP99Ms?: number
  rtpPacketizationP95Ms?: number
  rtpWriteP95Ms?: number
  rtpSendErrors?: number
  eventLoopUtilization?: number
  gcPauseP95Ms?: number
  decoderQueueDepth?: number
  pendingRenderFrames?: number
  audioQueueDepthMs?: number
  webrtcJitterBufferDepthMs?: number
  jitterBufferTargetMs?: number
  mseBufferedLeadMs?: number
  relayDroppedFrames?: number
  decodeDroppedFrames?: number
  presentationDroppedFrames?: number
  audioDroppedFrames?: number
  freezeCount?: number
  reconnectCount?: number
  resyncCount?: number
  videoResetCount?: number
  sourceRestartCount?: number
  roundTripTimeMs?: number
  packetsLost?: number
  nackCount?: number
  pliCount?: number
  retransmittedPackets?: number
  retransmittedBytes?: number
  packetsDiscardedOnSend?: number
  rtpSendDelayMs?: number
  mainThreadLongTaskCount?: number
  highestReceivedSequence?: number
  highestDecodedSequence?: number
  highestPresentedSequence?: number
  presentationSequenceLag?: number
  width?: number
  height?: number
  renderer: 'webrtc-video' | 'chromium-webcodecs' | 'firefox-mse' | 'webcodecs-webgl2-fallback'
  decoderPreference?: 'hardware' | 'software' | 'native'
  h264ProfileLevelId?: string
  negotiatedH264ProfileLevelId?: string
  sourceAttemptId?: string
  consumerGeneration?: number
  effectiveProfile: {
    transport: 'webrtc' | 'websocket'
    codec: string
    maxSize: number
    maxFps: number
    bitrate: number
    iFrameInterval: number
    audio: boolean
    control?: boolean
    tunnel?: string
    actualEncoder?: string
    width?: number
    height?: number
    pixelRate?: number
    h264ProfileLevelId?: string
    negotiatedH264ProfileLevelId?: string
    sourceAttemptId?: string
  }
  collectedAt: number
}

const statusCodes = new Set<DisplayViewerStreamStatusCode>([
  'audio-disabled',
  'reconnecting',
  'first-frame-timeout',
  'video-stalled',
  'stream-error'
])

const statusSeverities = new Set<DisplayViewerStreamStatusSeverity>(['info', 'warning', 'error'])

export const isDisplayViewerStreamStatus = (value: unknown): value is DisplayViewerStreamStatus => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === viewerStreamStatusMessageType &&
    typeof record.code === 'string' &&
    statusCodes.has(record.code as DisplayViewerStreamStatusCode) &&
    typeof record.severity === 'string' &&
    statusSeverities.has(record.severity as DisplayViewerStreamStatusSeverity) &&
    typeof record.blocking === 'boolean' &&
    typeof record.message === 'string' &&
    (record.transport === undefined || record.transport === 'webrtc' || record.transport === 'websocket')
  )
}

const optionalFiniteNumber = (value: unknown) =>
  value === undefined || (typeof value === 'number' && Number.isFinite(value))

const isEffectiveProfile = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const profile = value as Record<string, unknown>
  return (
    (profile.transport === 'webrtc' || profile.transport === 'websocket') &&
    typeof profile.codec === 'string' &&
    typeof profile.maxSize === 'number' &&
    Number.isFinite(profile.maxSize) &&
    typeof profile.maxFps === 'number' &&
    Number.isFinite(profile.maxFps) &&
    typeof profile.bitrate === 'number' &&
    Number.isFinite(profile.bitrate) &&
    typeof profile.iFrameInterval === 'number' &&
    Number.isFinite(profile.iFrameInterval) &&
    typeof profile.audio === 'boolean' &&
    (profile.control === undefined || typeof profile.control === 'boolean') &&
    (profile.tunnel === undefined || typeof profile.tunnel === 'string') &&
    (profile.actualEncoder === undefined || typeof profile.actualEncoder === 'string') &&
    optionalFiniteNumber(profile.width) &&
    optionalFiniteNumber(profile.height) &&
    optionalFiniteNumber(profile.pixelRate) &&
    (profile.h264ProfileLevelId === undefined || typeof profile.h264ProfileLevelId === 'string') &&
    (profile.negotiatedH264ProfileLevelId === undefined || typeof profile.negotiatedH264ProfileLevelId === 'string') &&
    (profile.sourceAttemptId === undefined || typeof profile.sourceAttemptId === 'string')
  )
}

export const isDisplayViewerStreamMetrics = (value: unknown): value is DisplayViewerStreamMetrics => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === viewerStreamMetricsMessageType &&
    record.version === 4 &&
    (record.transport === 'webrtc' || record.transport === 'websocket') &&
    record.fps === undefined &&
    record.latencyMs === undefined &&
    optionalFiniteNumber(record.sourceFps) &&
    optionalFiniteNumber(record.relayIngressFps) &&
    optionalFiniteNumber(record.bridgeInputFps) &&
    optionalFiniteNumber(record.rtpSentFps) &&
    optionalFiniteNumber(record.receivedFps) &&
    optionalFiniteNumber(record.decodedFps) &&
    optionalFiniteNumber(record.drawnFps) &&
    optionalFiniteNumber(record.presentedFps) &&
    optionalFiniteNumber(record.wireBitrateMbps) &&
    optionalFiniteNumber(record.sourceBitrateMbps) &&
    optionalFiniteNumber(record.sourceFrameSizeP95Bytes) &&
    optionalFiniteNumber(record.keyFrameSizeBytes) &&
    optionalFiniteNumber(record.frameGapP50Ms) &&
    optionalFiniteNumber(record.frameGapP95Ms) &&
    optionalFiniteNumber(record.frameGapP99Ms) &&
    optionalFiniteNumber(record.frameGapMaxMs) &&
    optionalFiniteNumber(record.sourceInterFrameP95Ms) &&
    optionalFiniteNumber(record.networkInterArrivalJitterP95Ms) &&
    optionalFiniteNumber(record.decodeP95Ms) &&
    optionalFiniteNumber(record.decodeToDrawP95Ms) &&
    optionalFiniteNumber(record.liveEdgeAgeP95Ms) &&
    optionalFiniteNumber(record.relayQueueDepthMs) &&
    optionalFiniteNumber(record.relayP95Ms) &&
    optionalFiniteNumber(record.relayP99Ms) &&
    optionalFiniteNumber(record.rtpPacketizationP95Ms) &&
    optionalFiniteNumber(record.rtpWriteP95Ms) &&
    optionalFiniteNumber(record.rtpSendErrors) &&
    optionalFiniteNumber(record.eventLoopUtilization) &&
    optionalFiniteNumber(record.gcPauseP95Ms) &&
    optionalFiniteNumber(record.decoderQueueDepth) &&
    optionalFiniteNumber(record.pendingRenderFrames) &&
    optionalFiniteNumber(record.audioQueueDepthMs) &&
    optionalFiniteNumber(record.webrtcJitterBufferDepthMs) &&
    optionalFiniteNumber(record.jitterBufferTargetMs) &&
    optionalFiniteNumber(record.mseBufferedLeadMs) &&
    optionalFiniteNumber(record.relayDroppedFrames) &&
    optionalFiniteNumber(record.decodeDroppedFrames) &&
    optionalFiniteNumber(record.presentationDroppedFrames) &&
    optionalFiniteNumber(record.audioDroppedFrames) &&
    optionalFiniteNumber(record.freezeCount) &&
    optionalFiniteNumber(record.reconnectCount) &&
    optionalFiniteNumber(record.resyncCount) &&
    optionalFiniteNumber(record.videoResetCount) &&
    optionalFiniteNumber(record.sourceRestartCount) &&
    optionalFiniteNumber(record.roundTripTimeMs) &&
    optionalFiniteNumber(record.packetsLost) &&
    optionalFiniteNumber(record.nackCount) &&
    optionalFiniteNumber(record.pliCount) &&
    optionalFiniteNumber(record.retransmittedPackets) &&
    optionalFiniteNumber(record.retransmittedBytes) &&
    optionalFiniteNumber(record.packetsDiscardedOnSend) &&
    optionalFiniteNumber(record.rtpSendDelayMs) &&
    optionalFiniteNumber(record.mainThreadLongTaskCount) &&
    optionalFiniteNumber(record.highestReceivedSequence) &&
    optionalFiniteNumber(record.highestDecodedSequence) &&
    optionalFiniteNumber(record.highestPresentedSequence) &&
    optionalFiniteNumber(record.presentationSequenceLag) &&
    optionalFiniteNumber(record.width) &&
    optionalFiniteNumber(record.height) &&
    (record.renderer === 'webrtc-video' ||
      record.renderer === 'chromium-webcodecs' ||
      record.renderer === 'firefox-mse' ||
      record.renderer === 'webcodecs-webgl2-fallback') &&
    (record.decoderPreference === undefined ||
      record.decoderPreference === 'hardware' ||
      record.decoderPreference === 'software' ||
      record.decoderPreference === 'native') &&
    (record.h264ProfileLevelId === undefined || typeof record.h264ProfileLevelId === 'string') &&
    (record.negotiatedH264ProfileLevelId === undefined || typeof record.negotiatedH264ProfileLevelId === 'string') &&
    (record.sourceAttemptId === undefined || typeof record.sourceAttemptId === 'string') &&
    optionalFiniteNumber(record.consumerGeneration) &&
    isEffectiveProfile(record.effectiveProfile) &&
    typeof record.collectedAt === 'number' &&
    Number.isFinite(record.collectedAt)
  )
}

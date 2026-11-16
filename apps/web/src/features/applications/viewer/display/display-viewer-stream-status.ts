import {
  optionalViewerStreamMetricFields,
  viewerStreamMetricsMessageType,
  viewerStreamStatusMessageType,
  type DisplayFrameSize,
  type DisplaySizePresentation,
  type FrameAcknowledgementStatus,
  type ViewerFrameObservation,
  type ViewerStreamStatusCode,
  type ViewerStreamStatusSeverity,
  type ViewerStreamStatusMessage,
  type ViewerStreamMetricsMessage
} from '@rebroid/android-application-core/viewer-stream'

export const frameAcknowledgementLabels = {
  'callback-unavailable': 'Frame callback unavailable',
  'waiting-for-frame': 'Waiting for a frame',
  'timestamp-unavailable': 'Frame timestamp unavailable',
  'waiting-for-quiet': 'Waiting for a quiet frame',
  'window-expired': 'Acknowledgement window expired',
  'channel-unavailable': 'Control channel unavailable',
  'channel-buffered': 'Control channel buffered',
  'send-failed': 'Send failed',
  sent: 'Sent'
} as const satisfies Record<FrameAcknowledgementStatus, string>

const statusCodes = new Set<ViewerStreamStatusCode>([
  'audio-disabled',
  'reconnecting',
  'first-frame-timeout',
  'video-stalled',
  'session-expired',
  'session-ready',
  'stream-error'
])

const statusSeverities = new Set<ViewerStreamStatusSeverity>(['info', 'warning', 'error'])

const isDisplayFrameSize = (value: unknown): value is DisplayFrameSize => {
  if (!value || typeof value !== 'object') return false
  const { width, height } = value as Record<string, unknown>
  return (
    typeof width === 'number' &&
    Number.isSafeInteger(width) &&
    width > 0 &&
    typeof height === 'number' &&
    Number.isSafeInteger(height) &&
    height > 0
  )
}

const isDisplaySizePresentation = (value: unknown): value is DisplaySizePresentation => {
  if (!value || typeof value !== 'object') return false
  const { previous, current, elapsedMs } = value as Record<string, unknown>
  return (
    isDisplayFrameSize(previous) &&
    isDisplayFrameSize(current) &&
    (previous.width !== current.width || previous.height !== current.height) &&
    (elapsedMs === undefined || (typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs >= 0))
  )
}

const isViewerFrameObservation = (value: unknown): value is ViewerFrameObservation => {
  if (!value || typeof value !== 'object') return false
  const { connectAt, presentedAt } = value as Record<string, unknown>
  return (
    typeof connectAt === 'number' &&
    Number.isFinite(connectAt) &&
    connectAt > 0 &&
    typeof presentedAt === 'number' &&
    Number.isFinite(presentedAt) &&
    presentedAt <= 8.64e15 &&
    presentedAt >= connectAt
  )
}

export const isDisplayViewerStreamStatus = (value: unknown): value is ViewerStreamStatusMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === viewerStreamStatusMessageType &&
    typeof record.code === 'string' &&
    statusCodes.has(record.code as ViewerStreamStatusCode) &&
    typeof record.severity === 'string' &&
    statusSeverities.has(record.severity as ViewerStreamStatusSeverity) &&
    typeof record.blocking === 'boolean' &&
    typeof record.message === 'string' &&
    ((record.code !== 'session-expired' && record.code !== 'session-ready') ||
      (typeof record.sessionId === 'string' && record.sessionId.length > 0)) &&
    (record.consumerAttemptId === undefined ||
      (typeof record.consumerAttemptId === 'string' && /^[a-z0-9-]{1,64}$/i.test(record.consumerAttemptId))) &&
    (record.failureStage === undefined ||
      (typeof record.failureStage === 'string' && /^[a-z0-9-]{1,48}$/i.test(record.failureStage))) &&
    (record.closeCode === undefined ||
      (typeof record.closeCode === 'number' &&
        Number.isInteger(record.closeCode) &&
        record.closeCode >= 1000 &&
        record.closeCode <= 4999)) &&
    (record.startup === undefined || isViewerFrameObservation(record.startup)) &&
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

export const isDisplayViewerStreamMetrics = (value: unknown): value is ViewerStreamMetricsMessage => {
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
    optionalViewerStreamMetricFields.every(field => optionalFiniteNumber(record[field])) &&
    (record.displaySizePresentation === undefined || isDisplaySizePresentation(record.displaySizePresentation)) &&
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
    (record.consumerAttemptId === undefined || typeof record.consumerAttemptId === 'string') &&
    (record.frameAcknowledgement === undefined ||
      (typeof record.frameAcknowledgement === 'string' &&
        Object.hasOwn(frameAcknowledgementLabels, record.frameAcknowledgement))) &&
    isEffectiveProfile(record.effectiveProfile) &&
    typeof record.collectedAt === 'number' &&
    Number.isFinite(record.collectedAt)
  )
}

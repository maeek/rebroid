export const viewerStreamStatusMessageType = 'rebroid-viewer-stream-status'
export const viewerStreamMetricsMessageType = 'rebroid-viewer-stream-metrics'

export type DisplayViewerStreamStatusCode =
  | 'audio-disabled'
  | 'reconnecting'
  | 'transport-fallback'
  | 'first-frame-timeout'
  | 'video-stalled'
  | 'stream-error'

export type DisplayViewerStreamStatusSeverity = 'info' | 'warning' | 'error'

export type DisplayViewerStreamStatus = {
  code: DisplayViewerStreamStatusCode
  severity: DisplayViewerStreamStatusSeverity
  blocking: boolean
  message: string
  transport?: 'webrtc' | 'websocket'
}

export type DisplayViewerStreamMetrics = {
  transport: 'webrtc' | 'websocket'
  fps?: number
  bitrateMbps?: number
  latencyMs?: number
  width?: number
  height?: number
  collectedAt: number
}

const statusCodes = new Set<DisplayViewerStreamStatusCode>([
  'audio-disabled',
  'reconnecting',
  'transport-fallback',
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

export const isDisplayViewerStreamMetrics = (value: unknown): value is DisplayViewerStreamMetrics => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.type === viewerStreamMetricsMessageType &&
    (record.transport === 'webrtc' || record.transport === 'websocket') &&
    optionalFiniteNumber(record.fps) &&
    optionalFiniteNumber(record.bitrateMbps) &&
    optionalFiniteNumber(record.latencyMs) &&
    optionalFiniteNumber(record.width) &&
    optionalFiniteNumber(record.height) &&
    typeof record.collectedAt === 'number' &&
    Number.isFinite(record.collectedAt)
  )
}

import type { ViewerStreamMetricsV4 } from '@rebroid/android-application-core/viewer-stream'

export type ViewerStreamSample = {
  sessionId: string
  runtimeId: string | null
  metrics: ViewerStreamMetricsV4
}

export const createViewerStreamMetrics = () => {
  const samples = new Map<string, ViewerStreamSample>()
  const listeners = new Set<() => void>()

  return {
    read: (surfaceId: string) => samples.get(surfaceId),
    record: (surfaceId: string, sample: ViewerStreamSample) => {
      samples.set(surfaceId, sample)
      listeners.forEach(listener => listener())
    },
    clear: () => {
      if (samples.size === 0) return
      samples.clear()
      listeners.forEach(listener => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

export type ViewerStreamMetrics = ReturnType<typeof createViewerStreamMetrics>

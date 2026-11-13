'use client'

import { useCallback, useEffect, useState } from 'react'
import { startupRuntimeKey } from './startup-timings'
import type { ViewerFrameObservation } from '../display/display-viewer-stream-status'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type ViewerStartupDurations = {
  requestToConnectMs: number
  connectToFrameMs: number
}

type FirstFrame = { runtime: string; at: number; viewer?: ViewerStartupDurations }

const readViewerDurations = (value: unknown): ViewerStartupDurations | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const { requestToConnectMs, connectToFrameMs } = value as Record<string, unknown>
  if (
    typeof requestToConnectMs !== 'number' ||
    !Number.isFinite(requestToConnectMs) ||
    requestToConnectMs < 0 ||
    typeof connectToFrameMs !== 'number' ||
    !Number.isFinite(connectToFrameMs) ||
    connectToFrameMs < 0
  )
    return undefined
  return { requestToConnectMs, connectToFrameMs }
}
const storageKey = 'rebroid.viewer.startup-first-frames.v1'
const maxRecords = 24
const readRecords = (): FirstFrame[] => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item: unknown): item is FirstFrame =>
          item !== null &&
          typeof item === 'object' &&
          'runtime' in item &&
          'at' in item &&
          typeof item.runtime === 'string' &&
          item.runtime.length <= 512 &&
          typeof item.at === 'number' &&
          Number.isFinite(new Date(item.at).getTime()) &&
          item.at > 0
      )
      .slice(-maxRecords)
      .map(({ runtime, at, viewer }) => ({ runtime, at, viewer: readViewerDurations(viewer) }))
  } catch {
    return []
  }
}

export const useStartupFirstFrame = (app?: AppDefinition) => {
  const runtime = startupRuntimeKey(app)
  const [record, setRecord] = useState<FirstFrame>()
  useEffect(() => {
    setRecord(readRecords().find(item => item.runtime === runtime))
  }, [runtime])

  const recordFirstFrame = useCallback(
    (observation?: ViewerFrameObservation, requestAt?: number) => {
      if (!runtime) return
      const records = readRecords()
      const viewer =
        observation && requestAt !== undefined
          ? readViewerDurations({
              requestToConnectMs: observation.connectAt - requestAt,
              connectToFrameMs: observation.presentedAt - observation.connectAt
            })
          : undefined
      const next = records.find(item => item.runtime === runtime) ?? {
        runtime,
        at: observation?.presentedAt ?? Date.now(),
        viewer
      }
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify([...records.filter(item => item.runtime !== runtime), next].slice(-maxRecords))
        )
      } catch {
        // Keep the observation in memory when browser storage is unavailable.
      }
      setRecord(current => (current?.runtime === runtime ? current : next))
    },
    [runtime]
  )

  const current = record?.runtime === runtime ? record : undefined
  return { firstFrameAt: current?.at, viewerStartup: current?.viewer, recordFirstFrame }
}

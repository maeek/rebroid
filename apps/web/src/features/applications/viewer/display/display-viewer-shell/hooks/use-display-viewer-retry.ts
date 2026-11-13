'use client'

import { useEffect, useRef, useState } from 'react'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

const retryTimeoutMs = 30_000

export const useDisplayViewerRetry = ({
  surfaces,
  surfaceRefreshVersion,
  refreshSurfaces,
  clearStatus
}: {
  surfaces: DisplayViewerSurface[]
  surfaceRefreshVersion?: number
  refreshSurfaces: () => void
  clearStatus: (surfaceId: string) => void
}) => {
  const refreshVersion = surfaceRefreshVersion ?? surfaces
  const pendingRef = useRef<{ surfaceId: string; refreshVersion: number | DisplayViewerSurface[] } | null>(null)
  const [retryingSurfaceId, setRetryingSurfaceId] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<{ surfaceId: string; message: string } | null>(null)
  const [frameGenerations, setFrameGenerations] = useState<Record<string, number>>({})

  useEffect(() => {
    const pending = pendingRef.current
    if (!pending || pending.refreshVersion === refreshVersion) return
    pendingRef.current = null
    setRetryingSurfaceId(null)
    if (!surfaces.some(surface => surface.id === pending.surfaceId)) return
    clearStatus(pending.surfaceId)
    // A renewed grant may retain its session ID. Replace the terminal browser consumer anyway.
    setFrameGenerations(current => ({ ...current, [pending.surfaceId]: (current[pending.surfaceId] ?? 0) + 1 }))
  }, [surfaces, refreshVersion, clearStatus])

  useEffect(() => {
    if (!retryingSurfaceId) return
    const timer = window.setTimeout(() => {
      pendingRef.current = null
      setRetryingSurfaceId(null)
      setRetryError({
        surfaceId: retryingSurfaceId,
        message: 'The display could not be reopened. Try again when the connection is available.'
      })
    }, retryTimeoutMs)
    return () => window.clearTimeout(timer)
  }, [retryingSurfaceId])

  const retrySurface = (surfaceId: string) => {
    if (pendingRef.current || !surfaces.some(surface => surface.id === surfaceId)) return
    pendingRef.current = { surfaceId, refreshVersion }
    setRetryError(null)
    setRetryingSurfaceId(surfaceId)
    try {
      refreshSurfaces()
    } catch {
      pendingRef.current = null
      setRetryingSurfaceId(null)
      setRetryError({
        surfaceId,
        message: 'The display could not be reopened. Try again when the connection is available.'
      })
    }
  }

  return { frameGenerations, retryingSurfaceId, retryError, retrySurface }
}

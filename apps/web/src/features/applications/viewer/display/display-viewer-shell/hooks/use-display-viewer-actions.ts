'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { toast } from '@/hooks/use-toast'
import { captureApplicationScreenshotAction } from '@/server/orchestrator/applications/actions/runtime/screenshot-actions'
import {
  createApplicationVirtualDisplayAction,
  releaseApplicationVirtualDisplayAction,
  startApplicationDisplayRecordingAction,
  stopApplicationDisplayRecordingAction
} from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type { ApplicationDisplayRecording } from '@/server/orchestrator/applications/types'

const downloadRecording = (
  applicationId: string,
  surface: DisplayViewerSurface,
  recording: ApplicationDisplayRecording
) => {
  const link = document.createElement('a')
  const query = new URLSearchParams({ surfaceSessionId: surface.sessionId })
  const encodedApplicationId = encodeURIComponent(applicationId)
  const recordingId = encodeURIComponent(recording.id)
  link.href = `/api/applications/${encodedApplicationId}/viewer/recordings/${recordingId}?${query.toString()}`
  link.download = recording.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const useDisplayViewerActions = ({
  applicationId,
  orderedSurfaces,
  onSurfacesChanged,
  setActiveSurfaceId
}: {
  applicationId: string
  orderedSurfaces: DisplayViewerSurface[]
  onSurfacesChanged?: () => void
  setActiveSurfaceId: (surfaceId: string) => void
}) => {
  const router = useRouter()
  const [isCapturing, startScreenshotTransition] = useTransition()
  const [isAddingDisplay, startAddDisplayTransition] = useTransition()
  const [closingSurfaceId, setClosingSurfaceId] = useState<string | null>(null)
  const [recordingSurfaceId, setRecordingSurfaceId] = useState<string | null>(null)
  const [recordingsBySurfaceId, setRecordingsBySurfaceId] = useState<
    Record<string, ApplicationDisplayRecording | undefined>
  >({})

  const refreshSurfaces = () => {
    if (onSurfacesChanged) {
      onSurfacesChanged()
      return
    }

    router.refresh()
  }

  const captureScreenshot = () => {
    startScreenshotTransition(async () => {
      try {
        const screenshot = await captureApplicationScreenshotAction(applicationId)
        const link = document.createElement('a')
        const timestamp = screenshot.capturedAt.replace(/[:.]/g, '-')

        link.href = screenshot.dataUrl
        link.download = `rebroid-${applicationId}-${timestamp}.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
      } catch (error) {
        toast({
          title: 'Could not capture screenshot',
          description: getToastErrorDescription(error),
          variant: 'destructive'
        })
      }
    })
  }

  const addDisplay = () => {
    startAddDisplayTransition(async () => {
      try {
        await createApplicationVirtualDisplayAction(applicationId)
        refreshSurfaces()
      } catch (error) {
        toast({
          title: 'Could not add display',
          description: getToastErrorDescription(error),
          variant: 'destructive'
        })
      }
    })
  }

  const toggleRecording = async (surface: DisplayViewerSurface) => {
    if (recordingSurfaceId) {
      return
    }

    const currentRecording = recordingsBySurfaceId[surface.id]
    setRecordingSurfaceId(surface.id)
    try {
      const recording =
        currentRecording?.status === 'recording'
          ? await stopApplicationDisplayRecordingAction(applicationId, surface.sessionId)
          : await startApplicationDisplayRecordingAction(applicationId, surface.sessionId)

      setRecordingsBySurfaceId(current => ({
        ...current,
        [surface.id]: recording
      }))

      if (recording.status === 'stopped') {
        downloadRecording(applicationId, surface, recording)
      }
    } catch (error) {
      toast({
        title: currentRecording?.status === 'recording' ? 'Could not stop recording' : 'Could not start recording',
        description: getToastErrorDescription(error),
        variant: 'destructive'
      })
    } finally {
      setRecordingSurfaceId(null)
    }
  }

  const releaseDisplaySurface = async (surface: DisplayViewerSurface) => {
    let lastError: unknown
    const candidates = [surface.surfaceId, surface.sessionId].filter(
      (candidate, index, items) => candidate && items.indexOf(candidate) === index
    )

    for (const candidate of candidates) {
      try {
        return await releaseApplicationVirtualDisplayAction(applicationId, candidate)
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }

  const closeDisplay = (surface: DisplayViewerSurface) => {
    setClosingSurfaceId(surface.id)
    startAddDisplayTransition(async () => {
      try {
        await releaseDisplaySurface(surface)
        setRecordingsBySurfaceId(current => {
          const next = { ...current }
          delete next[surface.id]
          return next
        })
        setActiveSurfaceId(orderedSurfaces.find(item => item.kind === 'main')?.id ?? 'main')
        refreshSurfaces()
      } catch (error) {
        toast({
          title: 'Could not close display',
          description: getToastErrorDescription(error),
          variant: 'destructive'
        })
      } finally {
        setClosingSurfaceId(null)
      }
    })
  }

  return {
    closingSurfaceId,
    isAddingDisplay,
    isCapturing,
    recordingSurfaceId,
    recordingsBySurfaceId,
    addDisplay,
    captureScreenshot,
    closeDisplay,
    toggleRecording
  }
}

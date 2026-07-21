'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getToastErrorDescription } from '@/features/applications/viewer/utils/viewer-error-utils'
import { toast } from '@/hooks/use-toast'
import { captureApplicationScreenshotAction } from '@/server/orchestrator/applications/actions/runtime/screenshot-actions'
import {
  createApplicationVirtualDisplayAction,
  releaseApplicationVirtualDisplayAction
} from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

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
          variant: 'danger'
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
          variant: 'danger'
        })
      }
    })
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
        setActiveSurfaceId(orderedSurfaces.find(item => item.kind === 'main')?.id ?? 'main')
        refreshSurfaces()
      } catch (error) {
        toast({
          title: 'Could not close display',
          description: getToastErrorDescription(error),
          variant: 'danger'
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
    addDisplay,
    captureScreenshot,
    closeDisplay
  }
}

'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { openViewerPopout } from '@/features/applications/viewer/display/display-viewer-shell/actions/viewer-popout'
import { useDisplayViewerShellState } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-shell-state'
import {
  getDisplayViewportSize,
  getFullscreenMediaSize
} from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-layout'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

type DisplayViewerShellState = ReturnType<typeof useDisplayViewerShellState>

type DisplayViewerContextValue = {
  applicationId: string
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsEnabled: boolean
} & DisplayViewerShellState

export type DisplayViewerProviderValue = {
  applicationId: string
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsEnabled: boolean
  initialKeyboardCaptureEnabled: boolean
  onKeyboardCaptureChange?: (enabled: boolean) => void
  onSurfacesChanged?: () => void
  surfaces: DisplayViewerSurface[]
}

const DisplayViewerContext = createContext<DisplayViewerContextValue | null>(null)

export const DisplayViewerProvider = ({
  children,
  value
}: {
  children: ReactNode
  value: DisplayViewerProviderValue
}) => {
  const shell = useDisplayViewerShellState({
    applicationId: value.applicationId,
    surfaces: value.surfaces,
    initialKeyboardCaptureEnabled: value.initialKeyboardCaptureEnabled,
    onSurfacesChanged: value.onSurfacesChanged,
    onKeyboardCaptureChange: value.onKeyboardCaptureChange
  })

  return (
    <DisplayViewerContext.Provider
      value={{
        applicationId: value.applicationId,
        canCaptureScreenshot: value.canCaptureScreenshot,
        canControl: value.canControl,
        controlsEnabled: value.controlsEnabled,
        ...shell
      }}
    >
      {children}
    </DisplayViewerContext.Provider>
  )
}

export const useDisplayViewerContext = () => {
  const context = useContext(DisplayViewerContext)

  if (!context) {
    throw new Error('useDisplayViewerContext must be used within DisplayViewerProvider')
  }

  return context
}

export const useDisplayViewerSurface = (surface: DisplayViewerSurface) => {
  const {
    activeSurface,
    applicationId,
    canCaptureScreenshot,
    canControl,
    controlsEnabled,
    fullscreen,
    fullscreenSurfaceId,
    keyboardCaptureEnabled,
    rotateSurface,
    rotatedSurfaceIds,
    setActiveSurfaceId,
    surfaceElementsRef,
    surfaceViewportElementsRef,
    toggleFullscreen,
    toggleKeyboardCapture,
    viewerActions,
    windowSize,
    workspaceHeight
  } = useDisplayViewerContext()
  const rotated = Boolean(rotatedSurfaceIds[surface.id])
  const fullscreenSurface = fullscreenSurfaceId === surface.id
  const viewportSize = getDisplayViewportSize({ surface, rotated, workspaceHeight })
  const mediaSize = fullscreenSurface ? getFullscreenMediaSize({ surface, rotated, windowSize }) : null

  const toggleSurfaceFullscreen = () => {
    setActiveSurfaceId(surface.id)
    void toggleFullscreen(surfaceViewportElementsRef.current[surface.id])
  }

  return {
    applicationId,
    canCaptureScreenshot,
    canControl,
    controlsEnabled,
    fullscreen,
    fullscreenSurface,
    isActive: surface.id === activeSurface?.id,
    isCapturing: viewerActions.isCapturing,
    isClosing: viewerActions.closingSurfaceId === surface.id,
    isRecordingBusy: viewerActions.recordingSurfaceId === surface.id,
    keyboardCaptureEnabled,
    mediaSize,
    recording: viewerActions.recordingsBySurfaceId[surface.id],
    viewportSize,
    onCaptureScreenshot: viewerActions.captureScreenshot,
    onClose: () => viewerActions.closeDisplay(surface),
    onOpenPopout: () => openViewerPopout(applicationId, surface),
    onRotate: () => rotateSurface(surface),
    onSelect: () => setActiveSurfaceId(surface.id),
    onSurfaceElement: (element: HTMLElement | null) => {
      surfaceElementsRef.current[surface.id] = element
    },
    onToggleFullscreen: toggleSurfaceFullscreen,
    onToggleKeyboardCapture: toggleKeyboardCapture,
    onToggleRecording: () => void viewerActions.toggleRecording(surface),
    onViewportElement: (element: HTMLDivElement | null) => {
      surfaceViewportElementsRef.current[surface.id] = element
    }
  }
}

export const useDisplayViewerControls = (surfaceId?: string) => {
  const {
    activeSurface,
    applicationId,
    canCaptureScreenshot,
    canControl,
    fullscreen,
    keyboardCaptureEnabled,
    orderedSurfaces,
    rotateActiveSurface,
    rotateSurface,
    setActiveSurfaceId,
    surfaceViewportElementsRef,
    toggleFullscreen,
    toggleKeyboardCapture,
    viewerActions
  } = useDisplayViewerContext()
  const surface = orderedSurfaces.find(item => item.id === surfaceId) ?? activeSurface ?? orderedSurfaces[0]
  const recording = surface ? viewerActions.recordingsBySurfaceId[surface.id] : undefined
  const isRecordingBusy = surface ? viewerActions.recordingSurfaceId === surface.id : false

  const toggleSurfaceFullscreen = () => {
    if (!surface) {
      return
    }

    setActiveSurfaceId(surface.id)
    void toggleFullscreen(surfaceViewportElementsRef.current[surface.id])
  }

  return {
    appId: applicationId,
    canCaptureScreenshot,
    canControl,
    fullscreen,
    isCapturing: viewerActions.isCapturing,
    keyboardCaptureEnabled,
    recording,
    runtimeAvailable: true,
    surfaceId: surface?.id,
    isRecordingBusy,
    onCaptureScreenshot: viewerActions.captureScreenshot,
    onOpenPopout: surface ? () => openViewerPopout(applicationId, surface) : undefined,
    onRotateViewer: surface ? () => rotateSurface(surface) : rotateActiveSurface,
    onToggleFullscreen: toggleSurfaceFullscreen,
    onToggleKeyboardCapture: toggleKeyboardCapture,
    onToggleRecording: surface ? () => void viewerActions.toggleRecording(surface) : undefined
  }
}

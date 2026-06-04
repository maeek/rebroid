'use client'

import { Visible } from '@/components/ui/visible'
import { openViewerPopout } from '@/features/applications/viewer/display/display-viewer-shell/actions/viewer-popout'
import { useDisplayViewerShellState } from '@/features/applications/viewer/display/display-viewer-shell/hooks/use-display-viewer-shell-state'
import {
  getDisplayViewportSize,
  getFullscreenMediaSize
} from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-layout'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { SurfaceTabs } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-tabs'
import { SurfaceToolbarActions } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-toolbar-actions'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const DisplayViewerShell = ({
  applicationId,
  surfaces,
  initialKeyboardCaptureEnabled,
  controlsEnabled,
  canControl,
  canCaptureScreenshot,
  onSurfacesChanged,
  onKeyboardCaptureChange,
  className
}: {
  applicationId: string
  surfaces: DisplayViewerSurface[]
  initialKeyboardCaptureEnabled: boolean
  controlsEnabled: boolean
  canControl: boolean
  canCaptureScreenshot: boolean
  onSurfacesChanged?: () => void
  onKeyboardCaptureChange?: (enabled: boolean) => void
  className?: string
}) => {
  const {
    activeSurface,
    fullscreen,
    fullscreenSurfaceId,
    keyboardCaptureEnabled,
    orderedSurfaces,
    rotatedSurfaceIds,
    scrollContainerRef,
    surfaceElementsRef,
    surfaceViewportElementsRef,
    viewerActions,
    windowSize,
    workspaceHeight,
    handleWorkspaceScroll,
    rotateActiveSurface,
    rotateSurface,
    scrollSurfaceIntoView,
    setActiveSurfaceId,
    toggleFullscreen,
    toggleKeyboardCapture
  } = useDisplayViewerShellState({
    applicationId,
    surfaces,
    initialKeyboardCaptureEnabled,
    onSurfacesChanged,
    onKeyboardCaptureChange
  })

  const activeRecording = activeSurface ? viewerActions.recordingsBySurfaceId[activeSurface.id] : undefined

  return (
    <div className={cn('relative flex h-screen w-screen flex-col overflow-hidden bg-background', className)}>
      <SurfaceTabs
        activeSurface={activeSurface}
        isAddingDisplay={viewerActions.isAddingDisplay}
        surfaces={orderedSurfaces}
        onAddDisplay={viewerActions.addDisplay}
        onSelectSurface={setActiveSurfaceId}
        onScrollSurfaceIntoView={scrollSurfaceIntoView}
      />
      <div
        ref={scrollContainerRef}
        className='min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth px-2 py-2 sm:px-6 sm:py-3'
        onScroll={handleWorkspaceScroll}
      >
        <div className='flex h-full w-max min-w-full flex-nowrap items-center justify-center gap-3 sm:gap-6'>
          {orderedSurfaces.map(surface => {
            const rotated = Boolean(rotatedSurfaceIds[surface.id])
            const fullscreenSurface = fullscreenSurfaceId === surface.id
            const viewportSize = getDisplayViewportSize({ surface, rotated, workspaceHeight })
            const mediaSize = fullscreenSurface ? getFullscreenMediaSize({ surface, rotated, windowSize }) : null

            return (
              <SurfacePanel
                key={surface.id}
                applicationId={applicationId}
                canCaptureScreenshot={canCaptureScreenshot}
                canControl={canControl}
                controlsEnabled={controlsEnabled}
                fullscreen={fullscreen}
                fullscreenSurface={fullscreenSurface}
                isActive={surface.id === activeSurface?.id}
                isCapturing={viewerActions.isCapturing}
                isClosing={viewerActions.closingSurfaceId === surface.id}
                isRecordingBusy={viewerActions.recordingSurfaceId === surface.id}
                keyboardCaptureEnabled={keyboardCaptureEnabled}
                mediaSize={mediaSize}
                recording={viewerActions.recordingsBySurfaceId[surface.id]}
                surface={surface}
                viewportSize={viewportSize}
                onCaptureScreenshot={viewerActions.captureScreenshot}
                onClose={() => viewerActions.closeDisplay(surface)}
                onRotate={() => rotateSurface(surface)}
                onSelect={() => setActiveSurfaceId(surface.id)}
                onSurfaceElement={element => {
                  surfaceElementsRef.current[surface.id] = element
                }}
                onToggleFullscreen={() => {
                  setActiveSurfaceId(surface.id)
                  void toggleFullscreen(surfaceViewportElementsRef.current[surface.id])
                }}
                onToggleKeyboardCapture={toggleKeyboardCapture}
                onToggleRecording={() => void viewerActions.toggleRecording(surface)}
                onViewportElement={element => {
                  surfaceViewportElementsRef.current[surface.id] = element
                }}
              />
            )
          })}
        </div>
      </div>
      <Visible when={controlsEnabled && Boolean(activeSurface)}>
        <div className='shrink-0 px-1 pb-2 sm:px-3 sm:pb-3'>
          <ViewerControlBar
            appId={applicationId}
            surfaceId={activeSurface?.id}
            runtimeAvailable
            canControl={canControl}
            canCaptureScreenshot={canCaptureScreenshot}
            fullscreen={fullscreen}
            isCapturing={viewerActions.isCapturing}
            keyboardCaptureEnabled={keyboardCaptureEnabled}
            surfaceActions={
              activeSurface ? (
                <SurfaceToolbarActions
                  recording={activeRecording}
                  canRecord={canCaptureScreenshot}
                  isRecordingBusy={viewerActions.recordingSurfaceId === activeSurface.id}
                  onToggleRecording={() => void viewerActions.toggleRecording(activeSurface)}
                />
              ) : null
            }
            onCaptureScreenshot={viewerActions.captureScreenshot}
            onOpenPopout={activeSurface ? () => openViewerPopout(applicationId, activeSurface) : undefined}
            onToggleKeyboardCapture={toggleKeyboardCapture}
            onRotateViewer={rotateActiveSurface}
          />
        </div>
      </Visible>
    </div>
  )
}

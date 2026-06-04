'use client'

import { Visible } from '@/components/ui/visible'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { openViewerPopout } from '@/features/applications/viewer/display/display-viewer-shell/actions/viewer-popout'
import { SurfaceChrome } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-chrome'
import { SurfaceToolbarActions } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-toolbar-actions'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type { ApplicationDisplayRecording } from '@/server/orchestrator/applications/types'

export const SurfacePanel = ({
  applicationId,
  canCaptureScreenshot,
  canControl,
  controlsEnabled,
  fullscreen,
  fullscreenSurface,
  isActive,
  isCapturing,
  isClosing,
  isRecordingBusy,
  keyboardCaptureEnabled,
  mediaSize,
  recording,
  surface,
  viewportSize,
  onCaptureScreenshot,
  onClose,
  onRotate,
  onSelect,
  onSurfaceElement,
  onToggleFullscreen,
  onToggleKeyboardCapture,
  onToggleRecording,
  onViewportElement
}: {
  applicationId: string
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsEnabled: boolean
  fullscreen: boolean
  fullscreenSurface: boolean
  isActive: boolean
  isCapturing: boolean
  isClosing: boolean
  isRecordingBusy: boolean
  keyboardCaptureEnabled: boolean
  mediaSize: { width: number; height: number } | null
  recording?: ApplicationDisplayRecording
  surface: DisplayViewerSurface
  viewportSize: { width: number; height: number }
  onCaptureScreenshot: () => void
  onClose: () => void
  onRotate: () => void
  onSelect: () => void
  onSurfaceElement: (element: HTMLElement | null) => void
  onToggleFullscreen: () => void
  onToggleKeyboardCapture: () => void
  onToggleRecording: () => void
  onViewportElement: (element: HTMLDivElement | null) => void
}) => (
  <section
    ref={onSurfaceElement}
    onFocus={onSelect}
    onPointerDown={onSelect}
    className='flex shrink-0 snap-center scroll-mx-2 flex-col overflow-hidden rounded-lg shadow-2xl sm:scroll-mx-6'
    style={{ width: viewportSize.width }}
  >
    <SurfaceChrome
      isActive={isActive}
      surface={surface}
      isClosing={isClosing}
      fullscreen={fullscreenSurface}
      onClose={onClose}
      onToggleFullscreen={onToggleFullscreen}
      onOpenPopout={() => openViewerPopout(applicationId, surface)}
    />
    <div
      ref={onViewportElement}
      className={cn(
        'relative overflow-hidden rounded-b-lg border border-border/70 bg-black',
        fullscreenSurface && 'flex h-screen w-screen items-center justify-center rounded-none border-0'
      )}
      style={fullscreenSurface ? undefined : { height: viewportSize.height }}
    >
      <div
        className={fullscreenSurface ? 'shrink-0 overflow-hidden bg-black' : 'h-full w-full'}
        style={mediaSize ? { width: mediaSize.width, height: mediaSize.height } : undefined}
      >
        <DisplayViewerFrame
          src={surface.src}
          keyboardCaptureEnabled={keyboardCaptureEnabled}
          surfaceId={surface.id}
        />
      </div>
      <Visible when={controlsEnabled && fullscreenSurface}>
        <ViewerControlBar
          appId={applicationId}
          surfaceId={surface.id}
          runtimeAvailable
          canControl={canControl}
          canCaptureScreenshot={canCaptureScreenshot}
          fullscreen={fullscreen}
          isCapturing={isCapturing}
          keyboardCaptureEnabled={keyboardCaptureEnabled}
          mode='floating'
          surfaceActions={
            <SurfaceToolbarActions
              recording={recording}
              canRecord={canCaptureScreenshot}
              isRecordingBusy={isRecordingBusy}
              onToggleRecording={onToggleRecording}
            />
          }
          onCaptureScreenshot={onCaptureScreenshot}
          onOpenPopout={() => openViewerPopout(applicationId, surface)}
          onToggleFullscreen={onToggleFullscreen}
          onToggleKeyboardCapture={onToggleKeyboardCapture}
          onRotateViewer={onRotate}
        />
      </Visible>
    </div>
  </section>
)

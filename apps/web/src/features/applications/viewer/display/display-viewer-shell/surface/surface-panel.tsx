'use client'

import type { ReactNode } from 'react'
import { Visible } from '@/components/ui/visible'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { useDisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfaceChrome } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-chrome'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfacePanel = ({
  surface,
  showName,
  chromeActions
}: {
  surface: DisplayViewerSurface
  showName: boolean
  chromeActions?: ReactNode
}) => {
  const {
    canControl,
    controlsEnabled,
    fullscreenSurface,
    isActive,
    isClosing,
    keyboardCaptureEnabled,
    mediaSize,
    onClose,
    onOpenPopout,
    onSelect,
    onStreamMetrics,
    onStreamStatus,
    onSurfaceElement,
    onToggleFullscreen,
    onViewportElement,
    streamStatus,
    viewportSize,
    workspaceHeight
  } = useDisplayViewerSurface(surface)

  return (
    <section
      ref={onSurfaceElement}
      onFocus={onSelect}
      onPointerDown={onSelect}
      aria-label={surface.name}
      className='flex shrink-0 snap-center items-start gap-2'
    >
      <div
        className='min-w-0'
        style={{ width: viewportSize.width }}
      >
        <SurfaceChrome
          isActive={isActive}
          showName={showName}
          actions={chromeActions}
          surface={surface}
          isClosing={isClosing}
          isFullscreen={fullscreenSurface}
          streamStatus={streamStatus}
          onClose={onClose}
          onOpenPopout={onOpenPopout}
          onToggleFullscreen={onToggleFullscreen}
        />
        <div
          ref={onViewportElement}
          className={cn(
            'relative overflow-hidden rounded-b-lg border border-surface-border/70 bg-black',
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
              keyboardCaptureEnabled={canControl && keyboardCaptureEnabled}
              isActive={isActive}
              onStreamMetrics={onStreamMetrics}
              onStreamStatus={onStreamStatus}
              surfaceId={surface.id}
            />
          </div>
          <Visible when={controlsEnabled && fullscreenSurface}>
            <ViewerControlBar
              mode='floating'
              surfaceId={surface.id}
            />
          </Visible>
        </div>
      </div>
      {controlsEnabled ? (
        <div
          className='w-8 shrink-0 overflow-y-auto scrollbar-none'
          style={{ maxHeight: Math.max(32, workspaceHeight - 16) }}
        >
          {isActive ? <ViewerControlBar surfaceId={surface.id} /> : null}
        </div>
      ) : null}
    </section>
  )
}

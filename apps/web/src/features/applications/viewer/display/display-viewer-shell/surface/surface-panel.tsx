'use client'

import { Visible } from '@/components/ui/visible'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { useDisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfaceChrome } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-chrome'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfacePanel = ({ surface }: { surface: DisplayViewerSurface }) => {
  const {
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
    viewportSize
  } = useDisplayViewerSurface(surface)

  return (
    <section
      ref={onSurfaceElement}
      onFocus={onSelect}
      onPointerDown={onSelect}
      className='flex shrink-0 snap-center scroll-mx-2 flex-col overflow-hidden rounded-panel sm:scroll-mx-6'
      style={{ width: viewportSize.width }}
    >
      <SurfaceChrome
        isActive={isActive}
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
            keyboardCaptureEnabled={keyboardCaptureEnabled}
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
    </section>
  )
}

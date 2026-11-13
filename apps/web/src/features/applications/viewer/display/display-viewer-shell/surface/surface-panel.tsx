'use client'

import type { ReactNode } from 'react'
import { IconX } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { useDisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import { SurfaceChrome } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-chrome'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'
import { StateView } from '@/shared/ui/state-view'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfacePanel = ({
  surface,
  showName,
  chromeActions,
  onDockMiniPlayer
}: {
  surface: DisplayViewerSurface
  showName: boolean
  chromeActions?: ReactNode
  onDockMiniPlayer?: () => void
}) => {
  const {
    canControl,
    controlsEnabled,
    fullscreenSurface,
    isActive,
    isClosing,
    isRetrying,
    frameGeneration,
    retryError,
    keyboardCaptureEnabled,
    mediaSize,
    onClose,
    onOpenPopout,
    onRetry,
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
  const miniPlayer = !fullscreenSurface && onDockMiniPlayer
  const aspectRatio = viewportSize.width / Math.max(viewportSize.height, 1)
  const frameStyle = mediaSize ? { width: mediaSize.width, height: mediaSize.height } : undefined

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
          {/* Keep the frame in place in the DOM so floating it retains the live stream. */}
          <div
            className={cn(
              fullscreenSurface ? 'shrink-0 overflow-hidden bg-black' : 'h-full w-full',
              miniPlayer &&
                'fixed right-6 bottom-6 z-30 overflow-hidden rounded-panel border border-surface-border bg-black shadow-floating'
            )}
            style={
              miniPlayer
                ? {
                    width: `min(20rem, calc(40svh * ${aspectRatio}))`,
                    height: 'auto',
                    aspectRatio: `${Math.max(viewportSize.width, 1)} / ${Math.max(viewportSize.height, 1)}`
                  }
                : frameStyle
            }
          >
            <div
              className={miniPlayer ? 'absolute inset-0' : 'h-full w-full'}
              inert={Boolean(miniPlayer)}
            >
              <div
                className='h-full w-full'
                inert={Boolean(streamStatus?.blocking)}
                aria-hidden={streamStatus?.blocking || undefined}
              >
                <DisplayViewerFrame
                  key={`${surface.sessionId}:${frameGeneration}`}
                  src={surface.src}
                  keyboardCaptureEnabled={
                    !miniPlayer && !streamStatus?.blocking && canControl && keyboardCaptureEnabled
                  }
                  isActive={!miniPlayer && !streamStatus?.blocking && isActive}
                  onStreamMetrics={onStreamMetrics}
                  onStreamStatus={onStreamStatus}
                  surfaceId={surface.id}
                />
              </div>
              {streamStatus?.blocking ? (
                <div className='absolute inset-0 overflow-auto bg-background'>
                  <StateView
                    className='py-4'
                    kind='error'
                    scope='immersive'
                    headingLevel={2}
                    title='Live display paused'
                    description='The connection to the app screen was interrupted.'
                    detail={retryError ?? undefined}
                    actions={[
                      {
                        label: 'Retry display',
                        onClick: onRetry,
                        pending: isRetrying,
                        pendingLabel: 'Reopening display…'
                      }
                    ]}
                  />
                </div>
              ) : null}
            </div>
            {miniPlayer ? (
              <div className='absolute top-2 right-2'>
                <IconActionButton
                  label='Close mini player'
                  onClick={miniPlayer}
                >
                  <IconX className='size-4' />
                </IconActionButton>
              </div>
            ) : null}
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
          className='w-[var(--viewer-rail-width)] shrink-0 overflow-y-auto scrollbar-none'
          style={{ maxHeight: Math.max(32, workspaceHeight - 16) }}
        >
          {isActive ? <ViewerControlBar surfaceId={surface.id} /> : null}
        </div>
      ) : null}
    </section>
  )
}

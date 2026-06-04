'use client'

import { Visible } from '@/components/ui/visible'
import { useDisplayViewerContext } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { SurfaceTabs } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-tabs'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { cn } from '@/lib/utils'

export const DisplayViewerShell = ({ className }: { className?: string }) => {
  const {
    activeSurface,
    controlsEnabled,
    handleWorkspaceScroll,
    orderedSurfaces,
    scrollContainerRef,
    scrollSurfaceIntoView,
    setActiveSurfaceId,
    viewerActions
  } = useDisplayViewerContext()

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
          {orderedSurfaces.map(surface => (
            <SurfacePanel
              key={surface.id}
              surface={surface}
            />
          ))}
        </div>
      </div>
      <Visible when={controlsEnabled && Boolean(activeSurface)}>
        <div className='shrink-0 px-1 pb-2 sm:px-3 sm:pb-3'>
          <ViewerControlBar />
        </div>
      </Visible>
    </div>
  )
}

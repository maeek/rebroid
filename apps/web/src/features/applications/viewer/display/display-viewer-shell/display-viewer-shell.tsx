'use client'

import { useDisplayViewerContext } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { SurfaceTabs } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-tabs'
import { ViewerControlBar } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-bar'
import { DisplayViewerLayout } from './display-viewer-layout'

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
    <DisplayViewerLayout
      className={className}
      scrollRef={scrollContainerRef}
      onScroll={handleWorkspaceScroll}
      tabs={
        <SurfaceTabs
          activeSurface={activeSurface}
          isAddingDisplay={viewerActions.isAddingDisplay}
          surfaces={orderedSurfaces}
          onAddDisplay={viewerActions.addDisplay}
          onSelectSurface={setActiveSurfaceId}
          onScrollSurfaceIntoView={scrollSurfaceIntoView}
        />
      }
      controls={controlsEnabled && activeSurface ? <ViewerControlBar /> : null}
    >
      {orderedSurfaces.map(surface => (
        <SurfacePanel
          key={surface.id}
          surface={surface}
        />
      ))}
    </DisplayViewerLayout>
  )
}

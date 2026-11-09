'use client'

import type { ReactNode } from 'react'
import { useDisplayViewerContext } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { SurfaceTabs } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-tabs'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { DisplayViewerLayout } from './display-viewer-layout'

export const DisplayViewerShell = ({
  className,
  streamingSettings
}: {
  className?: string
  streamingSettings?: ReactNode
}) => {
  const { isFeatureEnabled } = useFeatureFlags()
  const virtualDisplaysEnabled = isFeatureEnabled('feature.display-virtual')
  const {
    activeSurface,
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
    >
      {orderedSurfaces.map(surface => (
        <SurfacePanel
          key={surface.id}
          surface={surface}
          showName={surface.kind === 'virtual' || virtualDisplaysEnabled}
          chromeActions={surface.kind === 'main' ? streamingSettings : null}
        />
      ))}
    </DisplayViewerLayout>
  )
}

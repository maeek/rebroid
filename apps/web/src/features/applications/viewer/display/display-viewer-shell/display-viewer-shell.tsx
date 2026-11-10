'use client'

import type { ReactNode } from 'react'
import { useDisplayViewerContext } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { SurfaceTabs } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-tabs'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { DisplayViewerLayout } from './display-viewer-layout'
import { useViewerMiniPlayer } from './hooks/use-viewer-mini-player'

export const DisplayViewerShell = ({
  className,
  streamingSettings,
  clipboard,
  miniPlayerEnabled = false
}: {
  className?: string
  streamingSettings?: ReactNode
  clipboard?: ReactNode
  miniPlayerEnabled?: boolean
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
  const { anchorRef, floating, dockPlayer } = useViewerMiniPlayer(miniPlayerEnabled)

  return (
    <DisplayViewerLayout
      className={className}
      scrollRef={scrollContainerRef}
      onScroll={handleWorkspaceScroll}
      tabs={
        <>
          {miniPlayerEnabled ? (
            <div
              ref={anchorRef}
              aria-hidden='true'
              className='pointer-events-none absolute top-0 size-px'
            />
          ) : null}
          <SurfaceTabs
            activeSurface={activeSurface}
            isAddingDisplay={viewerActions.isAddingDisplay}
            surfaces={orderedSurfaces}
            onAddDisplay={viewerActions.addDisplay}
            onSelectSurface={setActiveSurfaceId}
            onScrollSurfaceIntoView={scrollSurfaceIntoView}
          />
        </>
      }
    >
      {orderedSurfaces.map(surface => (
        <SurfacePanel
          key={surface.id}
          surface={surface}
          showName={surface.kind === 'virtual' || virtualDisplaysEnabled}
          chromeActions={
            <>
              {surface.id === activeSurface?.id ? clipboard : null}
              {surface.kind === 'main' ? streamingSettings : null}
            </>
          }
          onDockMiniPlayer={floating && surface.id === activeSurface?.id ? dockPlayer : undefined}
        />
      ))}
    </DisplayViewerLayout>
  )
}

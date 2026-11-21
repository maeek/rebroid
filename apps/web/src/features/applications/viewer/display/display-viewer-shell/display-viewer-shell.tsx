'use client'

import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDisplayViewerContext } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import {
  AddVirtualDisplay,
  DisplaySwitcher
} from '@/features/applications/viewer/display/display-viewer-shell/surface/display-switcher'
import { MobileDisplaySelector } from '@/features/applications/viewer/display/display-viewer-shell/surface/mobile-display-selector'
import { StreamStatusIndicator } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-chrome'
import { SurfacePanel } from '@/features/applications/viewer/display/display-viewer-shell/surface/surface-panel'
import { MobileViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/mobile/mobile-viewer-controls'
import { ViewerControlProvider } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'
import { usePinnedViewer } from '@/features/applications/viewer/mini-player/pinned-viewer-context'
import { useFeatureFlags } from '@/shared/model/features/feature-flags-context'
import { DisplayViewerLayout } from './display-viewer-layout'
import { useViewerMiniPlayer } from './hooks/use-viewer-mini-player'
import { MobileViewerHeaderSlot } from './mobile-viewer-header-slot'

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
    applicationId,
    canControl,
    compact,
    compactSwitcher,
    controlsEnabled,
    handleWorkspaceScroll,
    multipleDisplays,
    orderedSurfaces,
    scrollContainerRef,
    setActiveSurfaceId,
    streamStatuses,
    viewerActions
  } = useDisplayViewerContext()
  const canAddDisplay =
    virtualDisplaysEnabled && canControl && orderedSurfaces.length === 1 && activeSurface?.kind === 'main'
  const { anchorRef, floating, dockPlayer } = useViewerMiniPlayer(miniPlayerEnabled && !compact)
  const headerSlot = useContext(MobileViewerHeaderSlot)
  const pinnedViewer = usePinnedViewer()
  const status = activeSurface ? streamStatuses[activeSurface.id] : undefined
  const selector = compact && <MobileDisplaySelector canAddDisplay={canAddDisplay} />

  return (
    <ViewerControlProvider>
      <DisplayViewerLayout
        className={className}
        scrollRef={scrollContainerRef}
        onScroll={handleWorkspaceScroll}
        multipleDisplays={multipleDisplays}
        compact={compact}
        stageNotice={compact && status && !status.blocking ? <StreamStatusIndicator status={status} /> : null}
        bottomControls={
          compact &&
          activeSurface && (
            <MobileViewerControls
              controlsEnabled={controlsEnabled}
              onFullscreen={() =>
                activeSurface.kind === 'main' && (pinnedViewer?.requestFullscreen(applicationId) ?? false)
              }
              actions={
                <>
                  {clipboard}
                  {streamingSettings}
                </>
              }
            />
          )
        }
        switcher={
          compactSwitcher && (
            <DisplaySwitcher
              activeSurfaceId={activeSurface?.id}
              surfaces={orderedSurfaces}
              onSelect={setActiveSurfaceId}
            />
          )
        }
        toolbar={
          <>
            {miniPlayerEnabled ? (
              <div
                ref={anchorRef}
                aria-hidden='true'
                className='pointer-events-none absolute top-0 size-px'
              />
            ) : null}
            {headerSlot && selector ? createPortal(selector, headerSlot) : null}
            {!headerSlot && selector ? <div className='flex shrink-0 justify-end px-2'>{selector}</div> : null}
            {!compact && canAddDisplay ? (
              <AddVirtualDisplay
                pending={viewerActions.isAddingDisplay}
                onAdd={viewerActions.addDisplay}
              />
            ) : null}
          </>
        }
      >
        {orderedSurfaces.map(surface => (
          <SurfacePanel
            key={surface.id}
            surface={surface}
            showName={!multipleDisplays && surface.kind === 'virtual'}
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
    </ViewerControlProvider>
  )
}

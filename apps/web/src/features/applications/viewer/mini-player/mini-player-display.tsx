'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { IconArrowsMinimize } from '@tabler/icons-react'
import { DisplayViewerFrame } from '@/features/applications/viewer/display/display-viewer-frame'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import { ViewerClipboard } from '@/features/applications/viewer/display/display-viewer-shell/surface/viewer-clipboard'
import { ViewerActivityKeepalive } from '@/features/applications/viewer/display/viewer-activity-keepalive'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { StateView } from '@/shared/ui/state-view'
import { DesktopMiniPlayer } from './desktop-mini-player'
import { MiniPlayerToolbar } from './mini-player-toolbar'
import { useDockedViewerPosition } from './use-docked-viewer-position'
import type { DockedViewer } from './pinned-viewer-context'
import type {
  DisplayViewerStreamMetrics,
  DisplayViewerStreamStatus
} from '@/features/applications/viewer/display/display-viewer-stream-status'

export const MiniPlayerDisplay = ({
  viewer,
  attached,
  floating,
  expanded,
  onExpandedChange,
  onRestore,
  onClose,
  onMinimize,
  hostElements
}: {
  viewer: DockedViewer
  attached: boolean
  floating: boolean
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onRestore: () => void
  onClose: () => void
  onMinimize?: () => void
  hostElements: Map<string, HTMLDivElement>
}) => {
  const controlRoute = useId()
  const frameKey = `${viewer.surface.sessionId}:${viewer.frameGeneration}:${viewer.surface.src}`
  const [stream, setStream] = useState<{
    key: string
    size?: { width: number; height: number }
    status?: DisplayViewerStreamStatus
  }>()
  const status = stream?.key === frameKey ? stream.status : undefined
  const size = (stream?.key === frameKey ? stream.size : undefined) ?? viewer.displaySize
  const compact = floating && !expanded
  const blocked = Boolean(status?.blocking && status.code !== 'reconnecting')
  const controlSurface = floating ? controlRoute : viewer.surface.id
  const [fullscreen, setFullscreen] = useState(false)
  const position = useDockedViewerPosition(viewer.element, floating, fullscreen)
  const inlineStyle = fullscreen ? { zIndex: 10 } : position

  const setHostElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) hostElements.set(viewer.appId, element)
      else hostElements.delete(viewer.appId)
    },
    [hostElements, viewer.appId]
  )

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === hostElements.get(viewer.appId))
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [hostElements, viewer.appId])

  const onStatus = (next: DisplayViewerStreamStatus) => {
    if (next.sessionId && next.sessionId !== viewer.surface.sessionId) return
    setStream(current => ({ ...(current?.key === frameKey ? current : undefined), key: frameKey, status: next }))
    if (viewer.element.isConnected) viewer.onStreamStatus(next)
  }

  const onMetrics = (metrics: DisplayViewerStreamMetrics) => {
    const { width, height } = metrics
    if (width && width > 0 && height && height > 0) {
      setStream(current => {
        if (current?.key === frameKey && current.size?.width === width && current.size.height === height) return current
        return { ...(current?.key === frameKey ? current : undefined), key: frameKey, size: { width, height } }
      })
    }
    if (viewer.element.isConnected) viewer.onStreamMetrics(metrics)
  }

  const canMinimize =
    !floating && !fullscreen && viewer.isActive && !(viewer.canControl && viewer.keyboardCaptureEnabled)
  useEffect(() => {
    if (!canMinimize || !onMinimize) return
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.key.toLowerCase() !== 'i' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest('input, textarea, select, [role=textbox], [role=dialog], [role=menu]'))) ||
        document.querySelector('[role=dialog][aria-modal=true]') ||
        !viewer.element.isConnected
      )
        return
      event.preventDefault()
      onMinimize()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canMinimize, onMinimize, viewer.element])

  return (
    <DesktopMiniPlayer
      name={viewer.name}
      expanded={expanded}
      canExpand={viewer.canControl}
      aspectRatio={size.width / size.height}
      viewerHref={appResourceHref(viewer.appId)}
      restoreLabel='Restore viewer'
      onRestoreInline={attached ? onRestore : undefined}
      onOpenViewer={onRestore}
      onClose={onClose}
      onExpandedChange={onExpandedChange}
      onElement={setHostElement}
      inlineStyle={floating ? undefined : inlineStyle}
      inlineOverlay={
        fullscreen && (
          <div className='absolute right-3 top-3 z-10'>
            <IconActionButton
              label='Exit fullscreen'
              onClick={() => void document.exitFullscreen()}
            >
              <IconArrowsMinimize className='size-3.5' />
            </IconActionButton>
          </div>
        )
      }
      expandedActions={viewer.canClipboard && <ViewerClipboard appId={viewer.appId} />}
      expandedToolbar={
        <MiniPlayerToolbar
          appId={viewer.appId}
          surfaceId={controlRoute}
          disabled={!viewer.canControl || status?.code !== 'session-ready'}
        />
      }
    >
      {floating && !blocked && <ViewerActivityKeepalive applicationId={viewer.appId} />}
      <div
        className='h-full w-full'
        inert={blocked}
        onFocus={floating ? undefined : viewer.onFocus}
      >
        <DisplayViewerFrame
          key={frameKey}
          src={viewer.surface.src}
          compact={compact}
          isActive={!floating && viewer.isActive && !blocked}
          surfaceId={blocked ? undefined : controlSurface}
          keyboardCaptureEnabled={!floating && viewer.canControl && viewer.keyboardCaptureEnabled}
          onMinimizeShortcut={canMinimize ? onMinimize : undefined}
          onStreamStatus={onStatus}
          onStreamMetrics={onMetrics}
        />
      </div>
      {status && blocked && (
        <div className='absolute inset-0 overflow-auto bg-surface-panel'>
          <StateView
            kind='error'
            scope='immersive'
            title='Live display paused'
            description={status.message}
            detail={viewer.retryError ?? undefined}
            actions={[
              viewer.element.isConnected
                ? {
                    label: 'Retry display',
                    onClick: viewer.onRetry,
                    pending: viewer.retrying,
                    pendingLabel: 'Reopening display…'
                  }
                : { label: 'Open viewer', href: appResourceHref(viewer.appId) }
            ]}
          />
        </div>
      )}
    </DesktopMiniPlayer>
  )
}

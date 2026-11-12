'use client'

import { useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Visible } from '@/components/ui/visible'
import {
  getViewerFrameClassName,
  getViewerFrameLayout,
  getViewerFrameStyle,
  getViewerSrc
} from '@/features/applications/viewer/player/android-viewer-layout'
import {
  postKeyboardCaptureState,
  useKeyboardCaptureSync,
  useKeyboardRelay,
  useViewerControlRelay
} from '@/features/applications/viewer/player/android-viewer-relay-hooks'
import { ViewerPlaceholderScreen } from '@/features/applications/viewer/player/viewer-placeholder-screen'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'

export type ViewerOrientation = 'portrait' | 'landscape'

type AppViewerProps = {
  chrome?: ReactNode
  app?: AppDefinition
  fullscreen?: boolean
  orientation?: ViewerOrientation
  viewerSettings?: ViewerSettings
  unavailableContent?: ReactNode
  canStart?: boolean
  isStarting?: boolean
  onStart?: () => void
}

const ViewerIframe = ({
  src,
  viewerFrameRef,
  keyboardCaptureEnabled
}: {
  src: string
  viewerFrameRef: RefObject<HTMLIFrameElement | null>
  keyboardCaptureEnabled: boolean
}) => (
  <iframe
    title='Android application viewer'
    ref={viewerFrameRef}
    src={src}
    key={src}
    className='h-full w-full border-0 bg-black'
    allow='fullscreen; clipboard-write; autoplay'
    onContextMenu={event => event.preventDefault()}
    onLoad={() => postKeyboardCaptureState(viewerFrameRef.current?.contentWindow, keyboardCaptureEnabled)}
  />
)

export const AppViewer = ({
  app,
  chrome,
  fullscreen,
  orientation = 'portrait',
  viewerSettings,
  unavailableContent,
  canStart = false,
  isStarting = false,
  onStart
}: AppViewerProps) => {
  const viewerFrameRef = useRef<HTMLIFrameElement>(null)
  const layout = getViewerFrameLayout(app, orientation)
  const viewerSrc = useMemo(
    () => (unavailableContent ? null : getViewerSrc(app, viewerSettings)),
    [app, unavailableContent, viewerSettings]
  )
  const keyboardCaptureEnabled = Boolean(viewerSettings?.keyboardCaptureEnabled)

  useViewerControlRelay(viewerSrc, viewerFrameRef)
  useKeyboardCaptureSync(viewerSrc, viewerFrameRef, keyboardCaptureEnabled)
  useKeyboardRelay(viewerSrc, viewerFrameRef, keyboardCaptureEnabled)

  return (
    <div
      data-viewer-frame
      className={getViewerFrameClassName(fullscreen)}
      onContextMenu={event => event.preventDefault()}
      style={getViewerFrameStyle(layout, fullscreen)}
    >
      {chrome ? (
        <div className='viewer-chrome absolute inset-x-0 top-0 z-10 flex h-[var(--viewer-chrome-height)] items-center justify-end bg-surface-band px-1.5'>
          {chrome}
        </div>
      ) : null}
      <Visible when={viewerSrc}>
        <ViewerIframe
          src={viewerSrc ?? ''}
          viewerFrameRef={viewerFrameRef}
          keyboardCaptureEnabled={keyboardCaptureEnabled}
        />
      </Visible>
      <Visible when={!viewerSrc && !unavailableContent}>
        <ViewerPlaceholderScreen
          app={app}
          canStart={canStart}
          isStarting={isStarting}
          onStart={onStart}
        />
      </Visible>
      {unavailableContent ? (
        <div className='absolute inset-x-0 bottom-0 top-(--viewer-chrome-height) flex items-center-safe overflow-y-auto bg-background'>
          {unavailableContent}
        </div>
      ) : null}
    </div>
  )
}

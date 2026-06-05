'use client'

import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
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
  app?: AppDefinition
  fullscreen?: boolean
  orientation?: ViewerOrientation
  viewerSettings?: ViewerSettings
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
  fullscreen,
  orientation = 'portrait',
  viewerSettings,
  canStart = false,
  isStarting = false,
  onStart
}: AppViewerProps) => {
  const viewerFrameRef = useRef<HTMLIFrameElement>(null)
  const layout = getViewerFrameLayout(app, orientation)
  const viewerSrc = useMemo(() => getViewerSrc(app, viewerSettings), [app, viewerSettings])
  const keyboardCaptureEnabled = Boolean(viewerSettings?.keyboardCaptureEnabled)

  useViewerControlRelay(viewerSrc, viewerFrameRef)
  useKeyboardCaptureSync(viewerSrc, viewerFrameRef, keyboardCaptureEnabled)
  useKeyboardRelay(viewerSrc, viewerFrameRef, keyboardCaptureEnabled)

  return (
    <div
      className={getViewerFrameClassName(fullscreen)}
      onContextMenu={event => event.preventDefault()}
      style={getViewerFrameStyle(layout, fullscreen)}
    >
      <Visible when={viewerSrc}>
        <ViewerIframe
          src={viewerSrc ?? ''}
          viewerFrameRef={viewerFrameRef}
          keyboardCaptureEnabled={keyboardCaptureEnabled}
        />
      </Visible>
      <Visible when={!viewerSrc}>
        <ViewerPlaceholderScreen
          app={app}
          canStart={canStart}
          isStarting={isStarting}
          onStart={onStart}
        />
      </Visible>
    </div>
  )
}

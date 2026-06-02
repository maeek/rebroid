'use client'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { getProtectedViewerShellUrl } from '@/features/applications/viewer/display-viewer-url'
import { ImagePullProgress } from '@/features/applications/viewer/image-pull-progress'
import {
  addViewerKeyboardRelay,
  keyboardCaptureMessageType,
  viewerControlMessageType
} from '@/features/applications/viewer/viewer-keyboard-relay'
import { getViewerPlaceholder } from '@/features/applications/viewer/viewer-placeholder'
import { cn } from '@/lib/utils'
import { getRedroidDisplayDimensionsFromArgs } from '@/shared/runtime/redroid-runtime'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'

export type ViewerOrientation = 'portrait' | 'landscape'

export const viewerControlCommandEventType = 'rebroid-viewer-control-command'

type AppViewerProps = {
  app?: AppDefinition
  fullscreen?: boolean
  orientation?: ViewerOrientation
  viewerSettings?: ViewerSettings
  canStart?: boolean
  isStarting?: boolean
  onStart?: () => void
}

type ViewerFrameLayout = {
  aspectRatio: string
  fullscreenHeight: string
  fullscreenMaxHeight: string
  fullscreenMaxWidth: string
  fullscreenWidth: string
  nonFullscreenMaxHeight: string
  nonFullscreenMaxWidth: string
  nonFullscreenWidth: string
}

const getViewerFrameSize = (app: AppDefinition | undefined, orientation: ViewerOrientation) => {
  const display = getRedroidDisplayDimensionsFromArgs(app?.containerArgs)
  const naturalLandscape = display.width >= display.height
  const isLandscape = orientation === 'landscape'

  return {
    width: isLandscape === naturalLandscape ? display.width : display.height,
    height: isLandscape === naturalLandscape ? display.height : display.width
  }
}

const getFullscreenHeight = (isWide: boolean, maxHeight: string, maxWidth: string, aspectRatioValue: number) =>
  isWide ? `min(${maxHeight}, calc(${maxWidth} / ${aspectRatioValue}))` : maxHeight

const getFullscreenWidth = (isWide: boolean, maxHeight: string, maxWidth: string, aspectRatioValue: number) =>
  isWide ? maxWidth : `min(${maxWidth}, calc(${maxHeight} * ${aspectRatioValue}))`

const getViewerFrameLayout = (app: AppDefinition | undefined, orientation: ViewerOrientation): ViewerFrameLayout => {
  const { width, height } = getViewerFrameSize(app, orientation)
  const aspectRatioValue = width / height
  const isWide = width > height
  const nonFullscreenMaxHeight = isWide ? 'min(70vh, 42rem)' : 'min(72vh, 54rem)'
  const nonFullscreenMaxWidth = isWide ? '68rem' : '28rem'
  const fullscreenMaxHeight = '100dvh'
  const fullscreenMaxWidth = '100dvw'

  return {
    aspectRatio: `${width} / ${height}`,
    fullscreenHeight: getFullscreenHeight(isWide, fullscreenMaxHeight, fullscreenMaxWidth, aspectRatioValue),
    fullscreenMaxHeight,
    fullscreenMaxWidth,
    fullscreenWidth: getFullscreenWidth(isWide, fullscreenMaxHeight, fullscreenMaxWidth, aspectRatioValue),
    nonFullscreenMaxHeight,
    nonFullscreenMaxWidth,
    nonFullscreenWidth: `min(100%, ${nonFullscreenMaxWidth}, calc(${nonFullscreenMaxHeight} * ${aspectRatioValue}))`
  }
}

const isReadyViewerApp = (app?: AppDefinition): app is AppDefinition =>
  Boolean(app?.id && app.running && app.status === 'running')

const getViewerSrc = (app: AppDefinition | undefined, viewerSettings: ViewerSettings | undefined) =>
  isReadyViewerApp(app) ? getProtectedViewerShellUrl(app.id, viewerSettings) : null

const selectFullscreenValue = <T,>(fullscreen: boolean | undefined, fullscreenValue: T, standardValue: T) =>
  fullscreen ? fullscreenValue : standardValue

const getViewerFrameStyle = (layout: ViewerFrameLayout, fullscreen?: boolean) => ({
  aspectRatio: layout.aspectRatio,
  height: selectFullscreenValue(fullscreen, layout.fullscreenHeight, undefined),
  maxHeight: selectFullscreenValue(fullscreen, layout.fullscreenMaxHeight, layout.nonFullscreenMaxHeight),
  maxWidth: selectFullscreenValue(fullscreen, layout.fullscreenMaxWidth, layout.nonFullscreenMaxWidth),
  width: selectFullscreenValue(fullscreen, layout.fullscreenWidth, layout.nonFullscreenWidth)
})

const getViewerFrameClassName = (fullscreen?: boolean) =>
  cn('relative flex w-full items-center justify-center overflow-hidden bg-black transition-all duration-150', {
    'h-full max-h-full max-w-full': fullscreen,
    'rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.28)]': !fullscreen
  })

const postKeyboardCaptureState = (targetWindow: Window | null | undefined, enabled: boolean) => {
  targetWindow?.postMessage(
    {
      type: keyboardCaptureMessageType,
      enabled
    },
    window.location.origin
  )
}

const useViewerControlRelay = (viewerSrc: string | null, viewerFrameRef: RefObject<HTMLIFrameElement | null>) => {
  useEffect(() => {
    if (!viewerSrc || typeof window === 'undefined') {
      return
    }

    const relayControlCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{ command?: string }>
      const command = customEvent.detail?.command
      const targetWindow = viewerFrameRef.current?.contentWindow
      if (!command || !targetWindow) {
        return
      }

      customEvent.preventDefault()
      targetWindow.postMessage(
        {
          type: viewerControlMessageType,
          command
        },
        window.location.origin
      )
    }

    window.addEventListener(viewerControlCommandEventType, relayControlCommand)

    return () => {
      window.removeEventListener(viewerControlCommandEventType, relayControlCommand)
    }
  }, [viewerFrameRef, viewerSrc])
}

const useKeyboardCaptureSync = (
  viewerSrc: string | null,
  viewerFrameRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!viewerSrc || typeof window === 'undefined') {
      return
    }

    const attempts = [0, 150, 400, 900]
    const timers = attempts.map(delay =>
      window.setTimeout(() => {
        postKeyboardCaptureState(viewerFrameRef.current?.contentWindow, enabled)
      }, delay)
    )

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [enabled, viewerFrameRef, viewerSrc])
}

const useKeyboardRelay = (
  viewerSrc: string | null,
  viewerFrameRef: RefObject<HTMLIFrameElement | null>,
  enabled: boolean
) => {
  useEffect(() => {
    if (!viewerSrc || !enabled || typeof window === 'undefined') {
      return
    }

    return addViewerKeyboardRelay({
      getTargetOrigin: () => window.location.origin,
      getTargetWindow: () => viewerFrameRef.current?.contentWindow,
      isEnabled: () => true
    })
  }, [enabled, viewerFrameRef, viewerSrc])
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

const ViewerPlaceholderBackground = ({ app }: { app?: AppDefinition }) => (
  <>
    <Visible when={app?.icon}>
      <div
        className='absolute inset-0 scale-110 bg-cover bg-center opacity-[0.08] blur-3xl'
        style={{ backgroundImage: `url("${resolveAppIconUrl(app?.icon ?? '')}")` }}
      />
    </Visible>
    <Visible when={app}>
      <div className='absolute inset-0 opacity-5 blur-3xl'>
        <AppIcon
          appId={app!.id}
          appName={app!.name}
          icon={app!.icon}
          className='h-full w-full'
        />
      </div>
    </Visible>
    <div className='absolute inset-0 bg-background/60 dark:bg-background/68' />
  </>
)

const ViewerPlaceholderAction = ({
  app,
  canStart,
  isStarting,
  toneClassName,
  Icon,
  showSpinner,
  onStart
}: {
  app?: AppDefinition
  canStart: boolean
  isStarting: boolean
  toneClassName: string
  Icon: ReturnType<typeof getViewerPlaceholder>['Icon']
  showSpinner: boolean
  onStart?: () => void
}) => {
  const canUseStart = canUsePlaceholderStart(app, canStart, onStart)

  if (canUseStart) {
    return (
      <ViewerPlaceholderStartButton
        appName={app?.name}
        isStarting={isStarting}
        toneClassName={toneClassName}
        onStart={onStart}
      />
    )
  }

  return (
    <ViewerPlaceholderStatusIcon
      Icon={Icon}
      showSpinner={showSpinner}
      isStarting={isStarting}
      toneClassName={toneClassName}
    />
  )
}

const canUsePlaceholderStart = (app: AppDefinition | undefined, canStart: boolean, onStart?: () => void) =>
  Boolean(app?.status === 'stopped' && canStart && onStart)

const getPlaceholderStatusIconClassName = (showSpinner: boolean, isStarting: boolean) =>
  showSpinner || isStarting ? 'size-6 animate-spin' : 'size-6'

const ViewerPlaceholderStatusIcon = ({
  Icon,
  showSpinner,
  isStarting,
  toneClassName
}: {
  Icon: ReturnType<typeof getViewerPlaceholder>['Icon']
  showSpinner: boolean
  isStarting: boolean
  toneClassName: string
}) => (
  <div
    className={cn(
      'flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/70',
      toneClassName
    )}
  >
    <Icon className={getPlaceholderStatusIconClassName(showSpinner, isStarting)} />
  </div>
)

const ViewerPlaceholderStartButton = ({
  appName,
  isStarting,
  toneClassName,
  onStart
}: {
  appName?: string
  isStarting: boolean
  toneClassName: string
  onStart?: () => void
}) => (
  <Button
    type='button'
    size='icon'
    variant='secondary'
    className={cn('size-12 rounded-full border border-border/70 bg-background/70 hover:bg-primary/20', toneClassName)}
    disabled={isStarting}
    onClick={onStart}
    aria-label={`Start ${appName}`}
  >
    {isStarting ? <IconLoader2 className='size-6 animate-spin' /> : <IconPlayerPlay className='size-6' />}
  </Button>
)

const ViewerPlaceholderIcon = ({ app }: { app?: AppDefinition }) => {
  if (!app) {
    return null
  }

  return (
    <AppIcon
      appId={app.id}
      appName={app.name}
      icon={app.icon}
      className='size-24 text-xl drop-shadow-[0_12px_24px_rgba(15,23,42,0.24)]'
    />
  )
}

const ViewerPlaceholderScreen = ({
  app,
  canStart,
  isStarting,
  onStart
}: Pick<AppViewerProps, 'app' | 'canStart' | 'isStarting' | 'onStart'>) => {
  const viewerPlaceholder = useMemo(() => getViewerPlaceholder(app), [app])

  return (
    <div className='relative flex h-full w-full items-center justify-center overflow-hidden px-6'>
      <ViewerPlaceholderBackground app={app} />
      <div className='relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center'>
        <ViewerPlaceholderIcon app={app} />
        <div className='flex flex-col items-center gap-3'>
          <ViewerPlaceholderAction
            app={app}
            canStart={Boolean(canStart)}
            isStarting={Boolean(isStarting)}
            toneClassName={viewerPlaceholder.toneClassName}
            Icon={viewerPlaceholder.Icon}
            showSpinner={viewerPlaceholder.showSpinner}
            onStart={onStart}
          />
          <div className='flex flex-col gap-2'>
            <h3 className='text-lg font-medium text-foreground'>{viewerPlaceholder.title}</h3>
            <Visible when={!viewerPlaceholder.showProgress}>
              <p className='text-sm text-secondary-foreground'>{viewerPlaceholder.description}</p>
            </Visible>
          </div>
        </div>
        <Visible when={viewerPlaceholder.showProgress}>
          <ImagePullProgress
            statusMessage={app?.statusMessage}
            progress={app?.imagePullProgress}
            className='w-full rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-left backdrop-blur-xs'
          />
        </Visible>
      </div>
    </div>
  )
}

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

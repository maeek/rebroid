'use client'
import { useEffect, useMemo, useRef } from 'react'
import { IconAlertTriangle, IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { getProtectedViewerShellUrl } from '@/features/applications/viewer/display-viewer-url'
import { ImagePullProgress } from '@/features/applications/viewer/image-pull-progress'
import { cn } from '@/lib/utils'
import { getRedroidDisplayDimensionsFromArgs } from '@/shared/runtime/redroid-runtime'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'

export type ViewerOrientation = 'portrait' | 'landscape'

const keyboardCaptureMessageType = 'rebroid-viewer-keyboard-capture'
const keyboardEventMessageType = 'rebroid-viewer-keyboard-event'
const viewerControlMessageType = 'rebroid-viewer-control-event'
export const viewerControlCommandEventType = 'rebroid-viewer-control-command'

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
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
}: {
  app?: AppDefinition
  fullscreen?: boolean
  orientation?: ViewerOrientation
  viewerSettings?: ViewerSettings
  canStart?: boolean
  isStarting?: boolean
  onStart?: () => void
}) => {
  const viewerFrameRef = useRef<HTMLIFrameElement>(null)
  const display = getRedroidDisplayDimensionsFromArgs(app?.containerArgs)
  const naturalLandscape = display.width >= display.height
  const isLandscape = orientation === 'landscape'
  const width = isLandscape === naturalLandscape ? display.width : display.height
  const height = isLandscape === naturalLandscape ? display.height : display.width
  const aspectRatio = `${width} / ${height}`
  const aspectRatioValue = width / height
  const isWide = width > height
  const isViewerReady = Boolean(app?.id && app.running && app.status === 'running')
  const nonFullscreenMaxHeight = isWide ? 'min(70vh, 42rem)' : 'min(72vh, 54rem)'
  const nonFullscreenMaxWidth = isWide ? '68rem' : '28rem'
  const nonFullscreenWidth = `min(100%, ${
    nonFullscreenMaxWidth
  }, calc(${nonFullscreenMaxHeight} * ${aspectRatioValue}))`
  const fullscreenMaxHeight = '100dvh'
  const fullscreenMaxWidth = '100dvw'
  const fullscreenHeight = isWide
    ? `min(${fullscreenMaxHeight}, calc(${fullscreenMaxWidth} / ${aspectRatioValue}))`
    : fullscreenMaxHeight
  const fullscreenWidth = isWide
    ? fullscreenMaxWidth
    : `min(${fullscreenMaxWidth}, calc(${fullscreenMaxHeight} * ${aspectRatioValue}))`
  const viewerSrc = useMemo(() => {
    if (!isViewerReady || !app?.id) {
      return null
    }

    return getProtectedViewerShellUrl(app.id, viewerSettings)
  }, [app?.id, isViewerReady, viewerSettings])

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
  }, [viewerSrc])

  useEffect(() => {
    if (!viewerSrc || typeof window === 'undefined') {
      return
    }

    const enabled = Boolean(viewerSettings?.keyboardCaptureEnabled)
    const targetWindow = viewerFrameRef.current?.contentWindow

    if (!targetWindow) {
      return
    }

    const attempts = [0, 150, 400, 900]
    const timers = attempts.map(delay =>
      window.setTimeout(() => {
        viewerFrameRef.current?.contentWindow?.postMessage(
          {
            type: keyboardCaptureMessageType,
            enabled
          },
          window.location.origin
        )
      }, delay)
    )

    return () => {
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [viewerSrc, viewerSettings?.keyboardCaptureEnabled])

  useEffect(() => {
    if (!viewerSrc || !viewerSettings?.keyboardCaptureEnabled || typeof window === 'undefined') {
      return
    }

    const relayKeyboardEvent = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) {
        return
      }

      const targetWindow = viewerFrameRef.current?.contentWindow
      if (!targetWindow) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      targetWindow.postMessage(
        {
          type: keyboardEventMessageType,
          eventType: event.type,
          key: event.key,
          code: event.code,
          location: event.location,
          repeat: event.repeat,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          capsLock: event.getModifierState('CapsLock'),
          numLock: event.getModifierState('NumLock'),
          scrollLock: event.getModifierState('ScrollLock')
        },
        window.location.origin
      )
    }

    window.addEventListener('keydown', relayKeyboardEvent, true)
    window.addEventListener('keyup', relayKeyboardEvent, true)

    return () => {
      window.removeEventListener('keydown', relayKeyboardEvent, true)
      window.removeEventListener('keyup', relayKeyboardEvent, true)
    }
  }, [viewerSrc, viewerSettings?.keyboardCaptureEnabled])

  const viewerPlaceholder = useMemo(() => {
    if (!app) {
      return {
        title: 'Viewer unavailable',
        description: 'App details are still loading.',
        toneClassName: 'text-secondary-foreground',
        Icon: IconPlayerPlay,
        showSpinner: false,
        showProgress: false
      }
    }

    if (app.status === 'error') {
      return {
        title: app.statusDetail?.title ?? 'App failed to start',
        description:
          app.statusDetail?.description ?? app.statusMessage ?? 'Rebroid reported an error while preparing the viewer.',
        toneClassName: 'text-destructive',
        Icon: IconAlertTriangle,
        showSpinner: false,
        showProgress: false
      }
    }

    if (app.status === 'provisioning' || app.status === 'removing') {
      return {
        title: app.statusDetail?.title ?? 'Preparing app',
        description:
          app.statusDetail?.description ??
          app.statusMessage ??
          'Preparing the Android environment and viewer connection.',
        toneClassName: 'text-primary',
        Icon: IconLoader2,
        showSpinner: true,
        showProgress: app.lifecycleStage === 'image_pulling'
      }
    }

    if (app.status === 'stopped') {
      return {
        title: app.statusDetail?.title ?? 'App is stopped',
        description: app.statusDetail?.description ?? app.statusMessage ?? 'Start the app to open the live viewer.',
        toneClassName: 'text-secondary-foreground',
        Icon: IconPlayerPlay,
        showSpinner: false,
        showProgress: false
      }
    }

    return {
      title: app.statusDetail?.title ?? 'Viewer unavailable',
      description:
        app.statusDetail?.description ?? app.statusMessage ?? 'The live viewer is not available for this environment.',
      toneClassName: 'text-secondary-foreground',
      Icon: IconAlertTriangle,
      showSpinner: false,
      showProgress: false
    }
  }, [app])

  const shouldHidePlaceholderDescription = viewerPlaceholder.showProgress

  const canUsePlaceholderStart = app?.status === 'stopped' && canStart && Boolean(onStart)

  return (
    <div
      className={cn('relative flex w-full items-center justify-center overflow-hidden bg-black', {
        'h-full max-h-full max-w-full': fullscreen,
        'rounded-2xl shadow-[0_18px_48px_rgba(0,0,0,0.28)]': !fullscreen
      })}
      onContextMenu={event => event.preventDefault()}
      style={{
        aspectRatio,
        height: fullscreen ? fullscreenHeight : undefined,
        maxHeight: fullscreen ? fullscreenMaxHeight : nonFullscreenMaxHeight,
        maxWidth: fullscreen ? fullscreenMaxWidth : nonFullscreenMaxWidth,
        width: fullscreen ? fullscreenWidth : nonFullscreenWidth
      }}
    >
      <Visible when={viewerSrc}>
        <iframe
          ref={viewerFrameRef}
          src={viewerSrc ?? undefined}
          key={viewerSrc}
          className='h-full w-full border-0 bg-black'
          allow='fullscreen; clipboard-write; autoplay'
          onContextMenu={event => event.preventDefault()}
          onLoad={() => {
            viewerFrameRef.current?.contentWindow?.postMessage(
              {
                type: keyboardCaptureMessageType,
                enabled: Boolean(viewerSettings?.keyboardCaptureEnabled)
              },
              window.location.origin
            )
          }}
        />
      </Visible>
      <Visible when={!viewerSrc}>
        <div className='relative flex h-full w-full items-center justify-center overflow-hidden px-6'>
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
          <div className='absolute inset-0 bg-background/68' />
          <div className='relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center'>
            <Visible when={app}>
              <AppIcon
                appId={app!.id}
                appName={app!.name}
                icon={app!.icon}
                className='size-24 text-xl drop-shadow-[0_12px_24px_rgba(15,23,42,0.24)]'
              />
            </Visible>
            <div className='flex flex-col items-center gap-3'>
              {canUsePlaceholderStart ? (
                <Button
                  type='button'
                  size='icon'
                  variant='secondary'
                  className={cn(
                    'size-12 rounded-full border border-border/70 bg-background/70 hover:bg-primary/20',
                    viewerPlaceholder.toneClassName
                  )}
                  disabled={isStarting}
                  onClick={onStart}
                  aria-label={`Start ${app?.name}`}
                >
                  {isStarting ? <IconLoader2 className='size-6 animate-spin' /> : <IconPlayerPlay className='size-6' />}
                </Button>
              ) : (
                <div
                  className={cn(
                    'flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/70',
                    viewerPlaceholder.toneClassName
                  )}
                >
                  <viewerPlaceholder.Icon
                    className={viewerPlaceholder.showSpinner || isStarting ? 'size-6 animate-spin' : 'size-6'}
                  />
                </div>
              )}
              <div className='flex flex-col gap-2'>
                <h3 className='text-lg font-medium text-foreground'>{viewerPlaceholder.title}</h3>
                <Visible when={!shouldHidePlaceholderDescription}>
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
      </Visible>
    </div>
  )
}

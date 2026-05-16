'use client'
import { useMemo } from 'react'
import { IconAlertTriangle, IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import { AppIcon } from '@/app/(protected)/_components/apps/app-icon'
import { ImagePullProgress } from '@/app/(protected)/_components/viewer/image-pull-progress'
import Android from '@/components/ui/android'
import { resolveAppIconUrl } from '@/lib/app-icons/url'
import { getScrcpyViewerUrl } from '@/lib/orchestrator/scrcpy'
import { cn } from '@/lib/utils'
import { AppDefinition } from '../../(standard)/constants'

const formatStateLabel = (value?: string | null) => {
  if (!value) {
    return 'Unknown state'
  }

  return value.replaceAll('_', ' ')
}

export const AppViewer = ({
  app,
  hideOutline,
  fullscreen
}: {
  app?: AppDefinition
  hideOutline?: boolean
  fullscreen?: boolean
}) => {
  const isBorderlessFullscreen = Boolean(hideOutline && fullscreen)
  const isViewerReady = Boolean(app?.id && app.adbPort && app.running && app.status === 'running')
  const viewerSrc = useMemo(() => {
    if (!isViewerReady || !app?.id || !app.adbPort) {
      return null
    }

    return getScrcpyViewerUrl({ applicationId: app.id, adbPort: app.adbPort })
  }, [app?.adbPort, app?.id, isViewerReady])

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
        title: 'App failed to start',
        description: app.statusMessage ?? 'The orchestrator reported an error while preparing the viewer.',
        toneClassName: 'text-destructive',
        Icon: IconAlertTriangle,
        showSpinner: false,
        showProgress: false
      }
    }

    if (app.status === 'provisioning' || app.status === 'removing') {
      return {
        title: formatStateLabel(app.lifecycleStage),
        description: app.statusMessage ?? 'Preparing the Android environment and viewer connection.',
        toneClassName: 'text-primary',
        Icon: IconLoader2,
        showSpinner: true,
        showProgress: app.lifecycleStage === 'image_pulling'
      }
    }

    if (app.status === 'stopped') {
      return {
        title: 'App is stopped',
        description: app.statusMessage ?? 'Start the app to open the live viewer.',
        toneClassName: 'text-secondary-foreground',
        Icon: IconPlayerPlay,
        showSpinner: false,
        showProgress: false
      }
    }

    return {
      title: 'Viewer unavailable',
      description: app.statusMessage ?? 'Scrcpy viewer URL is not available for this environment.',
      toneClassName: 'text-secondary-foreground',
      Icon: IconAlertTriangle,
      showSpinner: false,
      showProgress: false
    }
  }, [app])

  const content = (
    <div
      className={cn(
        'flex w-full items-center justify-center',
        isBorderlessFullscreen ? 'h-full bg-transparent' : 'bg-card h-[calc(100%+0.5rem)]',
        !hideOutline && 'p-2'
      )}
    >
      {viewerSrc ? (
        <iframe
          src={viewerSrc}
          className={cn('h-full w-full', !isBorderlessFullscreen && 'rounded-lg')}
        />
      ) : (
        <div
          className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden px-6',
            isBorderlessFullscreen ? 'bg-transparent' : 'rounded-lg border border-dashed border-border/60 bg-muted/30'
          )}
        >
          {app?.icon ? (
            <div
              className={cn(
                'absolute inset-0 bg-center bg-cover',
                isBorderlessFullscreen ? 'scale-110 opacity-20 blur-3xl' : 'opacity-10 blur-3xl'
              )}
              style={{ backgroundImage: `url("${resolveAppIconUrl(app.icon)}")` }}
            />
          ) : null}
          {!isBorderlessFullscreen && app && (
            <div className='absolute inset-0 opacity-10 blur-3xl'>
              <AppIcon
                appId={app.id}
                appName={app.name}
                icon={app.icon}
                className='h-full w-full'
              />
            </div>
          )}
          {isBorderlessFullscreen && <div className='absolute inset-0 bg-background/40' />}
          <div className='relative z-10 flex w-full max-w-sm flex-col items-center gap-5 text-center'>
            {app && (
              <AppIcon
                appId={app.id}
                appName={app.name}
                icon={app.icon}
                className='size-24 text-xl drop-shadow-[0_12px_24px_rgba(15,23,42,0.24)]'
              />
            )}
            <div className='flex flex-col items-center gap-3'>
              <div
                className={cn(
                  'flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/70',
                  viewerPlaceholder.toneClassName
                )}
              >
                <viewerPlaceholder.Icon className={viewerPlaceholder.showSpinner ? 'size-6 animate-spin' : 'size-6'} />
              </div>
              <div className='flex flex-col gap-2'>
                <h3 className='text-lg font-medium text-foreground'>{viewerPlaceholder.title}</h3>
                <p className='text-sm text-secondary-foreground'>{viewerPlaceholder.description}</p>
              </div>
            </div>
            {viewerPlaceholder.showProgress && (
              <ImagePullProgress
                statusMessage={app?.statusMessage}
                isImagePulling
                className='w-full rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-left backdrop-blur-xs'
              />
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (hideOutline) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center overflow-hidden',
          fullscreen
            ? 'aspect-[380/820] h-full w-auto max-h-full max-w-full'
            : 'h-full min-w-108.25 flex-1 rounded-lg bg-card lg:h-220.5 max-sm:min-h-[calc(100vh-4rem)] max-sm:min-w-screen'
        )}
      >
        {content}
      </div>
    )
  }

  return <Android className='h-auto w-full max-w-[28rem]'>{content}</Android>
}

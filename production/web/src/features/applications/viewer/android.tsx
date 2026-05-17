'use client'
import { useMemo } from 'react'
import { IconAlertTriangle, IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import Android from '@/components/ui/android'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { resolveAppIconUrl } from '@/features/applications/icons/url'
import { ImagePullProgress } from '@/features/applications/viewer/image-pull-progress'
import { getProtectedViewerShellUrl } from '@/features/applications/viewer/scrcpy-url'
import { cn } from '@/lib/utils'

export const AppViewer = ({
  app,
  hideOutline,
  fullscreen
}: {
  app?: AppDefinition
  hideOutline?: boolean
  fullscreen?: boolean
}) => {
  const isBorderless = Boolean(hideOutline)
  const isBorderlessFullscreen = Boolean(hideOutline && fullscreen)
  const isViewerReady = Boolean(app?.id && app.adbPort && app.running && app.status === 'running')
  const viewerSrc = useMemo(() => {
    if (!isViewerReady || !app?.id || !app.adbPort) {
      return null
    }

    return getProtectedViewerShellUrl(app.id)
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
        title: app.statusDetail?.title ?? 'App failed to start',
        description:
          app.statusDetail?.description ??
          app.statusMessage ??
          'The orchestrator reported an error while preparing the viewer.',
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
        app.statusDetail?.description ??
        app.statusMessage ??
        'Scrcpy viewer URL is not available for this environment.',
      toneClassName: 'text-secondary-foreground',
      Icon: IconAlertTriangle,
      showSpinner: false,
      showProgress: false
    }
  }, [app])

  const content = (
    <div
      className={cn('flex w-full justify-center', {
        'min-h-0 flex-1 items-stretch self-stretch bg-transparent': isBorderless,
        'h-full items-center bg-card': !isBorderless,
        'p-2': !hideOutline
      })}
    >
      {viewerSrc ? (
        <iframe
          src={viewerSrc}
          className={cn('h-full w-full', {
            'rounded-lg': !isBorderless
          })}
        />
      ) : (
        <div
          className={cn('relative flex w-full items-center justify-center overflow-hidden px-6', {
            'min-h-0 flex-1 self-stretch': isBorderless,
            'h-full': !isBorderless,
            'bg-transparent': isBorderless,
            'rounded-lg border border-dashed border-border/60 bg-muted/30': !isBorderless
          })}
        >
          <Visible when={app?.icon}>
            <div
              className={cn('absolute inset-0 bg-center bg-cover blur-3xl', {
                'scale-110': isBorderless,
                'opacity-20': isBorderlessFullscreen,
                'opacity-10': !isBorderlessFullscreen
              })}
              style={{ backgroundImage: `url("${resolveAppIconUrl(app?.icon ?? '')}")` }}
            />
          </Visible>
          <Visible when={!isBorderless && app}>
            <div className='absolute inset-0 opacity-10 blur-3xl'>
              <AppIcon
                appId={app!.id}
                appName={app!.name}
                icon={app!.icon}
                className='h-full w-full'
              />
            </div>
          </Visible>
          <Visible when={isBorderlessFullscreen}>
            <div className='absolute inset-0 bg-background/40' />
          </Visible>
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
            <Visible when={viewerPlaceholder.showProgress}>
              <ImagePullProgress
                statusMessage={app?.statusMessage}
                progress={app?.imagePullProgress}
                className='w-full rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-left backdrop-blur-xs'
              />
            </Visible>
          </div>
        </div>
      )}
    </div>
  )

  if (hideOutline) {
    return (
      <div
        className={cn('relative flex flex-col items-center overflow-hidden', {
          'aspect-380/820 h-full w-auto max-h-full max-w-full': fullscreen,
          'flex-1 w-full self-stretch rounded-lg bg-card lg:h-220.5 lg:min-w-108.25 max-sm:min-h-[calc(100vh-4rem)]':
            !fullscreen
        })}
      >
        {content}
      </div>
    )
  }

  return <Android className='h-auto w-full max-w-md'>{content}</Android>
}

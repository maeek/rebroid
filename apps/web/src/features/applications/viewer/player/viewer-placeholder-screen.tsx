import { useMemo } from 'react'
import { IconLoader2, IconPlayerPlay } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import { ImagePullProgress } from '@/features/applications/viewer/components/image-pull-progress'
import { getViewerPlaceholder } from '@/features/applications/viewer/player/viewer-placeholder'
import { cn } from '@/lib/utils'
import { resolveAppIconUrl } from '@/shared/model/media/image-url'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerPlaceholder } from '@/features/applications/viewer/player/viewer-placeholder'

export const ViewerPlaceholderScreen = ({
  app,
  canStart,
  isStarting,
  onStart,
  placeholder
}: {
  app?: AppDefinition
  canStart?: boolean
  isStarting?: boolean
  onStart?: () => void
  placeholder?: ViewerPlaceholder
}) => {
  const viewerPlaceholder = useMemo(() => placeholder ?? getViewerPlaceholder(app), [app, placeholder])

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
              <p className='text-sm text-secondary-foreground break-all'>{viewerPlaceholder.description}</p>
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
  const canUseStart = Boolean(app?.status === 'stopped' && canStart && onStart)

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
    <Icon className={showSpinner || isStarting ? 'size-6 animate-spin' : 'size-6'} />
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
  if (!app) return null

  return (
    <AppIcon
      appId={app.id}
      appName={app.name}
      icon={app.icon}
      className='size-24 text-xl drop-shadow-[0_12px_24px_rgba(15,23,42,0.24)]'
    />
  )
}

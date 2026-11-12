import { useState } from 'react'
import {
  IconAppWindow,
  IconCopy,
  IconHistoryOff,
  IconLoader2,
  IconPlayerPlayFilled,
  IconSettings
} from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Visible } from '@/components/ui/visible'
import { useOpenAppAsMe } from '@/hooks/use-open-app-as-me'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
import { requestApplicationStartAction } from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { dismissRecentAppAction } from '@/server/recent-apps/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { NavigationHint } from './navigation-hint'
import { variantStyles, type NavigationVariant } from './protected-navigation-config'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const RecentAppLink = ({
  app,
  variant,
  isActive,
  onNavigate,
  onStarted
}: {
  app: RecentApp
  variant: NavigationVariant
  isActive: boolean
  onNavigate?: () => void
  onStarted: () => void
}) => {
  const styles = variantStyles[variant]
  const router = useRouter()
  const [isStarting, setIsStarting] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const { isCloning, openAppAsMe } = useOpenAppAsMe()
  const [contextOpen, setContextOpen] = useState(false)
  const isOperating = app.status === 'provisioning' || app.status === 'removing' || isStarting
  const canStart = app.canStart && (app.status === 'stopped' || app.status === 'error')
  const rail = variant === 'rail'
  const highlighted = isActive || contextOpen
  const href = `/app/${encodeURIComponent(app.id)}`
  const label = app.ownerDisplayName ? `${app.name} · ${app.ownerDisplayName}` : app.name
  const icon = (
    <AppIcon
      appId={app.id}
      appName={app.name}
      icon={app.icon}
      className='size-6 text-[0.6rem]'
    />
  )

  const startAndOpen = async () => {
    if (!canStart || isStarting) return

    setIsStarting(true)
    router.push(href)
    onNavigate?.()
    try {
      unwrapActionResult(await requestApplicationStartAction(app.id))
      onStarted()
    } catch {
      // The destination page surfaces the runtime error state after navigation.
    } finally {
      setIsStarting(false)
    }
  }

  const removeFromRecent = async () => {
    if (isDismissing) return
    setIsDismissing(true)
    try {
      unwrapActionResult(await dismissRecentAppAction(app.id))
      notifyRecentAppsUpdated()
    } catch (error) {
      toast({
        title: 'Could not remove app from recent',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsDismissing(false)
    }
  }

  const trigger = (
    <ContextMenuTrigger asChild>
      <Link
        href={href}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        title={rail ? undefined : label}
        onClick={event => {
          if (contextOpen) event.preventDefault()
          else onNavigate?.()
        }}
        className={cn(
          'touch:select-none touch:[-webkit-touch-callout:none]',
          rail
            ? cn(styles.item, 'relative', highlighted && styles.activeItem)
            : 'flex min-w-0 flex-1 items-center gap-2'
        )}
      >
        {rail ? icon : <span className={styles.iconWrap}>{icon}</span>}
        {rail && app.status === 'running' ? (
          <span
            className='absolute right-1 top-1 size-2 rounded-full bg-success'
            aria-hidden='true'
          />
        ) : null}
        {!rail ? (
          <span className='flex min-w-0 items-baseline gap-2'>
            <span className={cn(styles.label, 'truncate')}>{app.name}</span>
            {app.ownerDisplayName ? (
              <span className='max-w-[50%] shrink-0 truncate text-xs text-foreground-muted'>
                {app.ownerDisplayName}
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    </ContextMenuTrigger>
  )

  return (
    <li className={cn(!rail && styles.item, 'group', !rail && highlighted && styles.activeItem)}>
      <ContextMenu onOpenChange={setContextOpen}>
        {rail ? <NavigationHint label={label}>{trigger}</NavigationHint> : trigger}
        <ContextMenuContent aria-label={`Actions for ${label}`}>
          <ContextMenuItem asChild>
            <Link
              href={href}
              onClick={onNavigate}
            >
              <IconAppWindow /> {app.ownerDisplayName ? 'View app' : 'Open app'}
            </Link>
          </ContextMenuItem>
          <ContextMenuItem asChild>
            <Link
              href={`${href}?view=configuration`}
              onClick={onNavigate}
            >
              <IconSettings /> Configuration
            </Link>
          </ContextMenuItem>
          {canStart ? (
            <ContextMenuItem
              disabled={isStarting}
              onSelect={() => void startAndOpen()}
            >
              <IconPlayerPlayFilled /> Start app
            </ContextMenuItem>
          ) : null}
          {app.canClone ? (
            <ContextMenuItem
              disabled={isCloning}
              onSelect={() => void openAppAsMe(app.id, onNavigate)}
            >
              <IconCopy /> Open as me
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            disabled={isDismissing}
            onSelect={() => void removeFromRecent()}
          >
            <IconHistoryOff /> Remove from recent
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <Visible when={!rail && app.status === 'running'}>
        <span
          title='Running'
          aria-label='Running'
          className='mr-2 size-2 shrink-0 rounded-full bg-success'
        />
      </Visible>
      <Visible when={!rail && isOperating}>
        <IconLoader2
          title={app.statusLabel ?? 'Working'}
          aria-label={app.statusLabel ?? 'Working'}
          className='mr-1.5 size-4 shrink-0 animate-spin text-primary'
        />
      </Visible>
      <Visible when={!rail && canStart && !isStarting}>
        <button
          type='button'
          title={`Start ${app.name}`}
          aria-label={`Start ${app.name}`}
          className='mr-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-foreground-muted opacity-0 transition hover:bg-primary/15 hover:text-primary focus:opacity-100 group-hover:opacity-100'
          onClick={() => void startAndOpen()}
        >
          <IconPlayerPlayFilled className='size-4' />
        </button>
      </Visible>
    </li>
  )
}

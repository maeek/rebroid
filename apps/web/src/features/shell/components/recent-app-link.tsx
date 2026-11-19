import { useRef, useState } from 'react'
import {
  IconAppWindow,
  IconCopy,
  IconHistoryOff,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconSettings
} from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { RowActions, RowActionButton } from '@/components/ui/row-actions'
import { Visible } from '@/components/ui/visible'
import { useOpenAppAsMe } from '@/hooks/use-open-app-as-me'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { cn } from '@/lib/utils'
import {
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { dismissRecentAppAction } from '@/server/recent-apps/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import { AppSnapshotPreview } from '@/shared/ui/app-icon/app-snapshot-preview'
import { AppStatusIndicator } from '@/shared/ui/app-icon/app-status-indicator'
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
  const linkRef = useRef<HTMLAnchorElement>(null)
  const rowRef = useRef<HTMLLIElement>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const { isCloning, openAppAsMe } = useOpenAppAsMe()
  const [contextOpen, setContextOpen] = useState(false)
  const status = isStarting ? 'provisioning' : app.status
  const statusLabel = isStarting ? 'Starting' : (app.statusLabel ?? app.status)
  const showStatus =
    status === 'running' || status === 'provisioning' || status === 'removing' || statusLabel === 'Stopping'
  const canStart = app.canStart && (app.status === 'stopped' || app.status === 'error')
  const canStop = app.canStop && app.status === 'running'
  const rail = variant === 'rail'
  const canPreviewSnapshot = variant !== 'drawer' && app.status === 'running' && app.canViewSnapshot
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

  const stopApp = async () => {
    if (!canStop || isStopping) return

    setIsStopping(true)
    try {
      unwrapActionResult(await requestApplicationStopAction(app.id))
      setStopDialogOpen(false)
      notifyRecentAppsUpdated()
    } catch (error) {
      toast({
        title: 'Could not stop app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsStopping(false)
    }
  }

  const trigger = (
    <ContextMenuTrigger asChild>
      <Link
        ref={linkRef}
        href={href}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        title={rail || canPreviewSnapshot ? undefined : label}
        onClick={event => {
          if (contextOpen) event.preventDefault()
          else onNavigate?.()
        }}
        className={cn(
          'touch:select-none touch:[-webkit-touch-callout:none]',
          rail
            ? cn(styles.item, 'relative', highlighted && styles.activeItem)
            : 'flex min-h-7 min-w-0 flex-1 items-center gap-2 touch:min-h-(--touch-target-size)',
          variant === 'drawer' && 'self-stretch'
        )}
      >
        {rail ? icon : <span className={styles.iconWrap}>{icon}</span>}
        {rail && showStatus && status && statusLabel ? (
          <AppStatusIndicator
            status={status}
            label={statusLabel}
            compact
            className='absolute right-1 top-1'
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

  let entry = trigger
  if (canPreviewSnapshot) {
    entry = (
      <AppSnapshotPreview
        appId={app.id}
        appName={app.name}
        anchor={rowRef}
        side='right'
        sideOffset={20}
        suppressed={contextOpen || stopDialogOpen || isStopping}
      >
        {trigger}
      </AppSnapshotPreview>
    )
  } else if (rail) {
    entry = <NavigationHint label={label}>{trigger}</NavigationHint>
  }

  return (
    <li
      ref={rowRef}
      data-row-actions-scope
      className={cn(!rail && styles.item, 'group', !rail && highlighted && styles.activeItem)}
    >
      <ContextMenu onOpenChange={setContextOpen}>
        {entry}
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
          {canStop ? (
            <ContextMenuItem onSelect={() => setStopDialogOpen(true)}>
              <IconPlayerStopFilled /> Stop app…
            </ContextMenuItem>
          ) : null}
          {app.canClone ? (
            <ContextMenuItem
              disabled={isCloning}
              onSelect={() => void openAppAsMe(app.id, onNavigate)}
            >
              <IconCopy /> Copy to my apps
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
      <ConfirmMutationDialog
        open={stopDialogOpen}
        title={`Stop ${app.name}?`}
        description='Android stops and active viewers disconnect.'
        tone='warning'
        confirmLabel='Stop app'
        confirmDisabled={!canStop}
        pendingLabel='Stopping…'
        pending={isStopping}
        finalFocus={linkRef}
        onOpenChange={setStopDialogOpen}
        onConfirm={() => void stopApp()}
      />
      {!rail && showStatus && status && statusLabel ? (
        <AppStatusIndicator
          status={status}
          label={statusLabel}
          compact
          className='mr-2'
        />
      ) : null}
      <Visible when={!rail && canStart && !isStarting}>
        <RowActions className='mr-0.5'>
          <RowActionButton
            label={`Start ${app.name}`}
            className='size-7 rounded-full text-foreground-muted'
            onClick={() => void startAndOpen()}
          >
            <IconPlayerPlayFilled className='size-4' />
          </RowActionButton>
        </RowActions>
      </Visible>
    </li>
  )
}

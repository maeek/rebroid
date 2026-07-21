'use client'

import { IconBell } from '@tabler/icons-react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Visible } from '@/components/ui/visible'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { cn } from '@/lib/utils'
import { listRunningApplicationNotificationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { NotificationCard } from '@/shared/ui/notifications/notification-card'
import type { RunningApplicationNotifications } from '@/shared/contracts/application'

const refreshIntervalMs = 10000

export const TopBarNotifications = () => {
  const { data, isLoading } = usePollingQuery<RunningApplicationNotifications[]>(
    'applications:running-notifications',
    () => listRunningApplicationNotificationsAction(),
    { intervalMs: refreshIntervalMs }
  )
  const notifications = data ?? []
  const totalCount = notifications.reduce((sum, app) => sum + app.notifications.length, 0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label='Notifications'
          className='relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground-muted transition hover:bg-surface-band/70 hover:text-foreground'
        >
          <IconBell className='size-5' />
          <Visible when={totalCount > 0}>
            <span
              className={cn(
                'absolute right-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-background bg-primary px-1 text-xs font-bold leading-none text-primary-foreground',
                totalCount > 9 && 'px-1.5'
              )}
            >
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          </Visible>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        collisionPadding={16}
        sideOffset={8}
        className='w-[min(24rem,calc(100vw-2rem))] border-surface-border/70 bg-surface-elevated/96 p-3 backdrop-blur-xl'
      >
        <div className='flex items-start justify-between gap-3 pb-3'>
          <div>
            <p className='text-sm font-medium text-foreground'>Notifications</p>
            <p className='text-xs text-foreground-muted'>Live notifications from your running apps.</p>
          </div>
          <Visible when={totalCount > 0}>
            <span className='rounded-full border border-surface-border/70 bg-surface-band/60 px-2 py-0.5 text-xs font-medium text-foreground'>
              {totalCount}
            </span>
          </Visible>
        </div>
        <Visible when={notifications.length === 0}>
          <div className='rounded-panel border border-dashed border-surface-border/70 bg-surface-band/30 px-4 py-6 text-sm text-foreground'>
            {isLoading ? 'Checking running apps for notifications.' : 'No live notifications from your running apps.'}
          </div>
        </Visible>
        <Visible when={notifications.length > 0}>
          <div className='scrollbar-thin grid max-h-[min(70vh,32rem)] gap-4 overflow-x-hidden overflow-y-auto pr-1'>
            {notifications.map(app => (
              <div
                key={app.appId}
                className='grid gap-2'
              >
                <div className='flex items-center justify-between gap-3'>
                  <Link
                    href={`/app/${app.appId}/manage`}
                    className='truncate text-sm font-medium text-foreground underline-offset-4 hover:underline'
                  >
                    {app.appName}
                  </Link>
                  <span className='rounded-full border border-surface-border/60 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground-muted'>
                    {app.notifications.length}
                  </span>
                </div>
                <div className='grid gap-2'>
                  {app.notifications.slice(0, 3).map((notification, index) => (
                    <NotificationCard
                      key={`${app.appId}-${notification.packageName}-${notification.raw}-${index}`}
                      notification={notification}
                      appId={app.appId}
                      appName={app.appName}
                      appIcon={app.appIcon}
                      appPackageName={app.appPackageName}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Visible>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { IconBell } from '@tabler/icons-react'
import Link from 'next/link'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Visible } from '@/components/ui/visible'
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh'
import { cn } from '@/lib/utils'
import { listRunningApplicationNotificationsAction } from '@/server/orchestrator/applications/read-actions'
import type { RunningApplicationNotifications } from '@/server/orchestrator/applications/types'

const refreshIntervalMs = 10000

export const TopBarNotifications = () => {
  const [notifications, setNotifications] = useState<RunningApplicationNotifications[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const totalCount = notifications.reduce((sum, app) => sum + app.notifications.length, 0)

  const load = async () => {
    const next = await listRunningApplicationNotificationsAction().catch(() => [])
    setNotifications(next)
    setHasLoaded(true)
  }

  useEffect(() => {
    void load()
  }, [])

  useForegroundRefresh({
    intervalMs: refreshIntervalMs,
    refresh: load
  })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label='Notifications'
          className='relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-secondary-foreground transition hover:bg-secondary/70 hover:text-foreground'
        >
          <IconBell className='size-5' />
          <Visible when={totalCount > 0}>
            <span
              className={cn(
                'absolute right-0 top-0 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-background bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground',
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
        className='w-[min(24rem,calc(100vw-2rem))] border-border/70 bg-card/95 p-3 backdrop-blur-xl'
      >
        <div className='flex items-start justify-between gap-3 pb-3'>
          <div>
            <p className='text-sm font-semibold text-foreground'>Notifications</p>
            <p className='text-xs text-secondary-foreground'>Live notifications from your running apps.</p>
          </div>
          <Visible when={totalCount > 0}>
            <span className='rounded-full border border-border/70 bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground'>
              {totalCount}
            </span>
          </Visible>
        </div>
        <Visible when={notifications.length === 0}>
          <div className='rounded-xl border border-dashed border-border/70 bg-secondary/30 px-4 py-6 text-sm text-secondary-foreground'>
            {hasLoaded ? 'No live notifications from your running apps.' : 'Checking running apps for notifications.'}
          </div>
        </Visible>
        <Visible when={notifications.length > 0}>
          <div className='grid max-h-[min(70vh,32rem)] gap-4 overflow-y-auto pr-1'>
            {notifications.map(app => (
              <div
                key={app.appId}
                className='grid gap-2'
              >
                <div className='flex items-center justify-between gap-3'>
                  <Link
                    href={`/app/${app.appId}/details`}
                    className='truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline'
                  >
                    {app.appName}
                  </Link>
                  <span className='rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                    {app.notifications.length}
                  </span>
                </div>
                <div className='grid gap-2'>
                  {app.notifications.slice(0, 3).map((notification, index) => (
                    <div
                      key={`${app.appId}-${notification.packageName}-${notification.raw}-${index}`}
                      className='rounded-xl border border-border/70 bg-secondary/35 px-3 py-2'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium text-foreground'>{notification.title}</p>
                          <p className='mt-1 line-clamp-2 text-sm text-secondary-foreground'>{notification.text}</p>
                        </div>
                      </div>
                      <p className='mt-2 truncate text-[11px] text-muted-foreground'>{notification.packageName}</p>
                    </div>
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

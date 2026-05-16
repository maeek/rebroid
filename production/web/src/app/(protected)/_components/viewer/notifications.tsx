'use client'

import { useEffect, useState } from 'react'
import { IconBell } from '@tabler/icons-react'
import { Section } from '@/components/ui/section'
import { getAndroidNotificationsAction } from '@/lib/orchestrator/actions'
import { AppDefinition } from '../../(standard)/constants'
import type { AndroidNotification } from '@/lib/orchestrator/types'

export const AndroidNotifications = ({ app }: { app: AppDefinition }) => {
  const [notifications, setNotifications] = useState<AndroidNotification[]>([])

  useEffect(() => {
    if (!app.running) {
      setNotifications([])
      return
    }

    let cancelled = false
    const load = async () => {
      const next = await getAndroidNotificationsAction(app.id).catch(() => [])
      if (!cancelled) setNotifications(next)
    }

    void load()
    const interval = window.setInterval(() => void load(), 10000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [app.id, app.running])

  return (
    <Section
      title='Android notifications'
      contentClassName='gap-3'
    >
      {notifications.length === 0 ? (
        <div className='flex items-center gap-2 text-sm text-secondary-foreground'>
          <IconBell className='size-4' />
          {app.running ? 'No notifications reported.' : 'Start the app to read Android notifications.'}
        </div>
      ) : (
        notifications.map(notification => (
          <div
            key={`${notification.packageName}-${notification.raw}`}
            className='rounded-md border border-input bg-card/40 p-3'
          >
            <div className='text-sm font-medium'>{notification.title}</div>
            <div className='text-xs text-secondary-foreground'>{notification.packageName}</div>
            <p className='pt-2 text-sm text-secondary-foreground'>{notification.text}</p>
          </div>
        ))
      )}
    </Section>
  )
}

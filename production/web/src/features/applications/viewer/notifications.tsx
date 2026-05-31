'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { getAndroidNotificationsAction } from '@/server/orchestrator/applications/read-actions'
import { NotificationCard } from './notification-card'
import type { AndroidNotification } from '@/server/orchestrator/applications/types'

export const AndroidNotifications = ({ app }: { app: AppDefinition }) => {
  const [notifications, setNotifications] = useState<AndroidNotification[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const visibleNotifications = notifications
  const previewNotifications = visibleNotifications.slice(0, 2)
  const hasOverflowNotifications = visibleNotifications.length > 2

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

  if (visibleNotifications.length === 0) {
    return null
  }

  const renderNotificationCard = (notification: AndroidNotification) => (
    <NotificationCard
      key={`${notification.packageName}-${notification.raw}`}
      notification={notification}
      appId={app.id}
      appName={app.name}
      appIcon={app.icon}
      appPackageName={app.apkPackageName}
    />
  )

  return (
    <>
      <Section
        title='Android notifications'
        titleClassName='pb-4'
        contentClassName='gap-3'
      >
        {previewNotifications.map(renderNotificationCard)}
        <Visible when={hasOverflowNotifications}>
          <Button
            variant='secondary'
            className='w-full sm:w-fit'
            onClick={() => setIsDialogOpen(true)}
          >
            Show all {visibleNotifications.length} notifications
          </Button>
        </Visible>
      </Section>
      <Dialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      >
        <DialogContent className='max-h-[min(80vh,44rem)] sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Android notifications</DialogTitle>
            <DialogDescription>Live notifications reported by the Android app session.</DialogDescription>
          </DialogHeader>
          <div className='grid max-h-[min(60vh,34rem)] gap-3 overflow-y-auto pr-1'>
            {visibleNotifications.map(renderNotificationCard)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

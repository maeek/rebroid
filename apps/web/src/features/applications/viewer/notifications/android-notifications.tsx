'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getAndroidNotificationsAction } from '@/server/orchestrator/applications/actions/runtime/notification-actions'
import { NotificationCard } from '@/shared/ui/notifications/notification-card'
import type { AndroidNotification } from '@/server/orchestrator/applications/types'

export const AndroidNotifications = ({ app }: { app: AppDefinition }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { data } = usePollingQuery<AndroidNotification[]>(
    ['applications', app.id, 'notifications'],
    () => getAndroidNotificationsAction(app.id),
    { enabled: app.running, intervalMs: 10_000 }
  )
  const notifications = data ?? []
  const visibleNotifications = notifications
  const previewNotifications = visibleNotifications.slice(0, 2)
  const hasOverflowNotifications = visibleNotifications.length > 2

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
        surface='plain'
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
          <div className='scrollbar-thin grid max-h-[min(60vh,34rem)] gap-3 overflow-x-hidden overflow-y-auto pr-1'>
            {visibleNotifications.map(renderNotificationCard)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

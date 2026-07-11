'use client'

import { IconAlarm, IconBell, IconBrandAndroid, IconDownload, IconSettings } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import type { AndroidNotification } from '@/shared/contracts/application'

type NotificationCardProps = {
  notification: AndroidNotification
  appId?: string
  appName?: string
  appIcon?: string | null
  appPackageName?: string | null
  compact?: boolean
}

const packageLabel = (packageName: string) => {
  const candidate = packageName.split('.').at(-1) ?? packageName
  return candidate.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

const sourceForNotification = (
  notification: AndroidNotification,
  installedApp?: Pick<NotificationCardProps, 'appId' | 'appName' | 'appIcon' | 'appPackageName'>
) => {
  const packageName = notification.packageName.toLowerCase()

  if (installedApp?.appId && installedApp.appName && installedApp.appPackageName?.toLowerCase() === packageName) {
    return { name: installedApp.appName, installed: true, Icon: IconBell }
  }
  if (packageName.includes('deskclock') || packageName.includes('alarmclock')) {
    return { name: 'Clock', installed: false, Icon: IconAlarm }
  }
  if (packageName.includes('downloads') || packageName.includes('downloadprovider')) {
    return { name: 'Downloads', installed: false, Icon: IconDownload }
  }
  if (packageName.includes('settings')) {
    return { name: 'Android Settings', installed: false, Icon: IconSettings }
  }
  if (packageName === 'android' || packageName.includes('systemui')) {
    return { name: 'Android System', installed: false, Icon: IconBrandAndroid }
  }

  return {
    name: notification.appName?.trim() || packageLabel(notification.packageName),
    installed: false,
    Icon: IconBell
  }
}

export const NotificationCard = ({
  notification,
  appId,
  appName,
  appIcon,
  appPackageName,
  compact = false
}: NotificationCardProps) => {
  const source = sourceForNotification(notification, { appId, appName, appIcon, appPackageName })
  const SourceIcon = source.Icon

  return (
    <article
      title={notification.packageName}
      className={cn(
        'flex items-start gap-3 rounded-feature border border-white/8 bg-surface-band/55 shadow-control backdrop-blur-md transition-colors hover:bg-surface-band/70',
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      )}
    >
      {source.installed && appId && appName ? (
        <AppIcon
          appId={appId}
          appName={appName}
          icon={appIcon}
          className={compact ? 'size-9 shrink-0 text-[0.55rem]' : 'size-10 shrink-0 text-[0.6rem]'}
        />
      ) : (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-panel bg-primary/12 text-primary',
            compact ? 'size-9' : 'size-10'
          )}
        >
          <SourceIcon className={compact ? 'size-4.5' : 'size-5'} />
        </div>
      )}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-xs font-medium uppercase tracking-wide text-foreground-muted'>{source.name}</p>
        <p className={cn('truncate font-medium text-foreground', compact ? 'mt-0.5 text-sm' : 'mt-1 text-sm')}>
          {notification.title}
        </p>
        <p className={cn('text-foreground-muted', compact ? 'mt-0.5 line-clamp-2 text-xs' : 'mt-1 text-sm')}>
          {notification.text}
        </p>
      </div>
    </article>
  )
}

import type { ReactNode } from 'react'
import { IconChevronRight } from '@tabler/icons-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { panelSurfaceClassName, focusRingClassName } from '@/components/ui/surface'
import { cn } from '@/lib/utils'
import { AppIcon } from './app-icon'
import { AppStatusIndicator } from './app-status-indicator'
import type { RecentApp } from '@/shared/contracts/recent-app'

export const AppShortcut = ({ app, loading = false }: { app?: RecentApp; loading?: boolean }) => {
  const className = cn(panelSurfaceClassName, 'group flex min-w-0 items-center gap-3 p-4')
  let status: ReactNode = null
  if (loading) status = <Skeleton className='h-5 w-16' />
  else if (app?.status)
    status = (
      <AppStatusIndicator
        status={app.status}
        label={app.status}
      />
    )
  const content = (
    <>
      {loading || !app ? (
        <Skeleton className='size-10 shrink-0' />
      ) : (
        <AppIcon
          appId={app.id}
          appName={app.name}
          icon={app.icon}
          className='size-10 shrink-0'
        />
      )}
      <div className='grid min-w-0 flex-1 gap-1'>
        <div className='flex h-5 min-w-0 items-center text-sm font-medium group-hover:text-primary'>
          {loading ? (
            <Skeleton className='h-4 w-3/4' />
          ) : (
            <span
              className='truncate'
              title={app?.name}
            >
              {app?.name}
            </span>
          )}
        </div>
        <div className='flex h-5 min-w-0 items-center'>{status}</div>
      </div>
      <IconChevronRight
        className='size-4 shrink-0 text-foreground-muted'
        aria-hidden='true'
      />
    </>
  )
  if (loading || !app) return <div className={className}>{content}</div>
  return (
    <Link
      href={`/app/${encodeURIComponent(app.id)}`}
      className={cn(className, focusRingClassName, 'hover:bg-control-hover')}
    >
      {content}
    </Link>
  )
}

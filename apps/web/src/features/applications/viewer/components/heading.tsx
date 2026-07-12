import type { ReactNode } from 'react'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { AppIcon } from '@/shared/ui/app-icon/app-icon'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

const appStatusBadgeTone = (status?: AppDefinition['status']): StatusBadgeTone => {
  if (status === 'error') {
    return 'danger'
  }

  if (status === 'provisioning' || status === 'removing') {
    return 'warning'
  }

  if (status === 'running') {
    return 'success'
  }

  return 'neutral'
}

export const AppViewerHeading = ({
  app,
  children,
  className,
  showStatusBadge = false
}: {
  app?: AppDefinition
  children?: ReactNode
  className?: string
  showStatusBadge?: boolean
}) => {
  return (
    <div
      className={cn(
        'text-3xl max-sm:text-lg font-medium shrink-0 flex gap-4 justify-between items-center w-full py-4 max-sm:pb-0 flex-wrap',
        className
      )}
    >
      <div className='flex gap-4 items-center overflow-hidden'>
        <Visible when={app}>
          <AppIcon
            appId={app!.id}
            appName={app!.name}
            icon={app!.icon}
            className='shrink-0 size-10 -z-[1]'
          />
        </Visible>
        <h1 className='text-ellipsis text-nowrap overflow-hidden max-w-[calc(100%-3rem)]'>
          {app?.name || '<App Name>'}
        </h1>
        <Visible when={showStatusBadge && app}>
          <StatusBadge
            tone={appStatusBadgeTone(app?.status)}
            className='shrink-0 capitalize'
          >
            {app?.status}
          </StatusBadge>
        </Visible>
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

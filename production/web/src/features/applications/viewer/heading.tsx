import { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppIcon } from '@/features/applications/components/app-icon'
import { AppDefinition } from '@/features/applications/domain/app-definition'
import { cn } from '@/lib/utils'

const appStatusBadgeVariant = (status?: AppDefinition['status']) => {
  if (status === 'error') {
    return 'destructive'
  }

  if (status === 'provisioning' || status === 'removing') {
    return 'warning'
  }

  if (status === 'running') {
    return 'status'
  }

  return 'secondary'
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
        <span className='text-ellipsis text-nowrap overflow-hidden max-w-[calc(100%-3rem)]'>
          {app?.name || '<App Name>'}
        </span>
        <Visible when={showStatusBadge && app}>
          <Badge
            variant={appStatusBadgeVariant(app?.status)}
            className='shrink-0 capitalize'
          >
            {app?.status}
          </Badge>
        </Visible>
      </div>
      <div className='shrink-0'>{children}</div>
    </div>
  )
}

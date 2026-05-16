'use client'

import { IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PlatformContainer } from '@/lib/orchestrator/types'

export const stateClassName = (state: string) => {
  if (state === 'running') {
    return 'bg-primary/15 text-primary'
  }
  if (state === 'exited' || state === 'dead') {
    return 'bg-destructive/15 text-destructive'
  }
  return 'bg-secondary text-secondary-foreground'
}

export const ContainerNameCell = ({ container, className }: { container: PlatformContainer; className?: string }) => {
  const name = container.names[0] ?? container.shortId

  return (
    <div className={cn('flex min-w-[16rem] flex-col gap-1', className)}>
      <div className='flex min-w-0 items-center gap-2'>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='block min-w-0 truncate font-medium'>{name}</span>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
        </Tooltip>
        {container.managed && (
          <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>managed</span>
        )}
      </div>
      <div className='truncate text-xs text-muted-foreground'>{container.shortId}</div>
    </div>
  )
}

export const ContainerStateBadge = ({ state }: { state: string }) => (
  <span className={cn('inline-flex w-fit rounded-full px-2.5 py-1 text-xs', stateClassName(state))}>{state}</span>
)

export const ContainerActions = ({
  container,
  busyId,
  onStop,
  onRemove,
  className
}: {
  container: PlatformContainer
  busyId: string | null
  onStop: (container: PlatformContainer) => void
  onRemove: (container: PlatformContainer) => void
  className?: string
}) => (
  <div className={cn('flex justify-end gap-2', className)}>
    {container.applicationId && (
      <Button
        asChild
        variant='secondary'
        className='min-w-24'
      >
        <Link href={`/app/${container.applicationId}?logs=1`}>
          <IconTerminal2 className='size-4' />
          Logs
        </Link>
      </Button>
    )}
    <Button
      type='button'
      variant='secondary'
      disabled={busyId === container.id || container.state !== 'running'}
      onClick={() => onStop(container)}
    >
      <IconPlayerStopFilled className='size-4' />
    </Button>
    <Button
      type='button'
      variant='destructive'
      disabled={busyId === container.id}
      onClick={() => onRemove(container)}
    >
      <IconTrash className='size-4' />
    </Button>
  </div>
)

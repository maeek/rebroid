'use client'

import Link from 'next/link'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import type { PlatformContainer } from '@/server/orchestrator/platform/types'

const stateClassName = (state: string) => {
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
            <Link
              href={`/settings/orchestrator/containers/${container.id}`}
              className='block min-w-0 truncate font-medium hover:text-primary'
            >
              {name}
            </Link>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
        </Tooltip>
        <Visible when={container.managed}>
          <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>managed</span>
        </Visible>
        <Visible when={container.orphaned}>
          <span className='shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive'>orphaned</span>
        </Visible>
      </div>
      <div className='truncate text-xs text-muted-foreground'>{container.shortId}</div>
    </div>
  )
}

export const ContainerStateBadge = ({ state }: { state: string }) => (
  <span className={cn('inline-flex w-fit rounded-full px-2.5 py-1 text-xs', stateClassName(state))}>{state}</span>
)

'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import type { PlatformContainer } from '@/server/orchestrator/platform/types'
import type { ColumnDef } from '@tanstack/react-table'

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
              href={`/infrastructure/containers/${container.id}`}
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

export const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

export const createContainerColumns = (): ColumnDef<PlatformContainer>[] => [
  {
    id: 'name',
    accessorFn: container => containerName(container),
    header: 'Container',
    size: 288,
    meta: { label: 'Container' },
    cell: ({ row }) => <ContainerNameCell container={row.original} />
  },
  {
    id: 'state',
    accessorFn: container => container.state,
    header: 'State',
    size: 128,
    meta: { label: 'State' },
    cell: ({ row }) => <ContainerStateBadge state={row.original.state} />
  },
  {
    id: 'image',
    accessorFn: container => container.image,
    header: 'Image',
    size: 384,
    meta: { label: 'Image' },
    cell: ({ row }) => <div className='truncate text-sm text-secondary-foreground'>{row.original.image}</div>
  },
  {
    id: 'applicationId',
    accessorFn: container => container.applicationId ?? '',
    header: 'Application',
    size: 256,
    meta: { label: 'Application' },
    cell: ({ row }) => (
      <div className='truncate text-sm text-secondary-foreground'>{row.original.applicationId ?? 'unmanaged'}</div>
    )
  },
  {
    id: 'networks',
    header: 'Networks',
    size: 288,
    enableSorting: false,
    meta: { label: 'Networks' },
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-1 text-sm text-secondary-foreground'>
        {row.original.networks.length > 0
          ? row.original.networks.map(network => (
              <Link
                key={network}
                href={`/infrastructure/networks/${encodeURIComponent(network)}`}
                className='max-w-full truncate rounded-full bg-background/60 px-2 py-0.5 hover:text-primary'
              >
                {network}
              </Link>
            ))
          : 'none'}
      </div>
    )
  }
]

export const ContainerMobileCard = ({
  container,
  selected,
  onSelectedChange
}: {
  container: PlatformContainer
  selected: boolean
  onSelectedChange: (selected: boolean) => void
}) => (
  <div className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4'>
    <div className='flex items-start gap-3'>
      <Checkbox
        checked={selected}
        aria-label='Select container'
        onCheckedChange={checked => onSelectedChange(checked === true)}
      />
      <ContainerNameCell
        container={container}
        className='min-w-0 flex-1'
      />
    </div>
    <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
      <div>
        <dt className='text-secondary-foreground'>State</dt>
        <dd>
          <ContainerStateBadge state={container.state} />
        </dd>
      </div>
      <div>
        <dt className='text-secondary-foreground'>Application</dt>
        <dd className='truncate'>{container.applicationId ?? 'unmanaged'}</dd>
      </div>
      <div className='col-span-2'>
        <dt className='text-secondary-foreground'>Image</dt>
        <dd className='truncate'>{container.image}</dd>
      </div>
      <div className='col-span-2'>
        <dt className='text-secondary-foreground'>Networks</dt>
        <dd className='truncate'>{container.networks.length > 0 ? container.networks.join(', ') : 'none'}</dd>
      </div>
    </dl>
  </div>
)

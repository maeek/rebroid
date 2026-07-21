'use client'

import Link from 'next/link'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import type { PlatformContainer } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

const stateTone = (state: string): StatusBadgeTone => {
  if (state === 'running') return 'success'
  if (state === 'exited' || state === 'dead') return 'danger'
  if (state === 'paused' || state === 'restarting') return 'warning'
  return 'neutral'
}

export const ContainerNameCell = ({ container, className }: { container: PlatformContainer; className?: string }) => {
  const name = container.names[0] ?? container.shortId

  return (
    <div className={cn('flex min-w-[16rem] flex-col gap-1', className)}>
      <div className='flex min-w-0 items-center gap-2'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/runtime/containers/${container.id}`}
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
          <span className='shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger'>orphaned</span>
        </Visible>
      </div>
      <div className='truncate text-xs text-foreground-muted'>{container.shortId}</div>
    </div>
  )
}

export const ContainerStateBadge = ({ state }: { state: string }) => (
  <StatusBadge
    tone={stateTone(state)}
    className='w-fit capitalize'
  >
    {state}
  </StatusBadge>
)

export const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

export const createContainerColumns = (): ColumnDef<PlatformContainer>[] => [
  {
    id: 'name',
    accessorFn: container => containerName(container),
    header: 'Container',
    size: 288,
    meta: { label: 'Container', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => <ContainerNameCell container={row.original} />
  },
  {
    id: 'state',
    accessorFn: container => container.state,
    header: 'State',
    size: 128,
    meta: { label: 'State', skeleton: { kind: 'badge' } },
    cell: ({ row }) => <ContainerStateBadge state={row.original.state} />
  },
  {
    id: 'image',
    accessorFn: container => container.image,
    header: 'Image',
    size: 384,
    meta: { label: 'Image', skeleton: { kind: 'text', width: 'w-[84%]' } },
    cell: ({ row }) => <div className='truncate text-sm text-foreground-muted'>{row.original.image}</div>
  },
  {
    id: 'applicationId',
    accessorFn: container => container.applicationId ?? '',
    header: 'Application',
    size: 256,
    meta: { label: 'Application', skeleton: { kind: 'text', width: 'w-[68%]' } },
    cell: ({ row }) => (
      <div className='truncate text-sm text-foreground-muted'>{row.original.applicationId ?? 'unmanaged'}</div>
    )
  },
  {
    id: 'networks',
    header: 'Networks',
    size: 288,
    enableSorting: false,
    meta: { label: 'Networks', skeleton: { kind: 'text', width: 'w-[74%]' } },
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-1 text-sm text-foreground-muted'>
        {row.original.networks.length > 0
          ? row.original.networks.map(network => (
              <Link
                key={network}
                href={`/runtime/networks/${encodeURIComponent(network)}`}
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

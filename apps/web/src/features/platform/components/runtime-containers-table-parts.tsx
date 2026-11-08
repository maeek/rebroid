'use client'

import { StatusBadge, type StatusBadgeTone } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { ApplicationReference } from '@/shared/ui/application-reference'
import { ResourceLink } from '@/shared/ui/resource-link'
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
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className='flex min-w-0 items-center gap-2'>
        <Tooltip>
          <TooltipTrigger asChild>
            <ResourceLink
              href={`/runtime/containers/${container.id}`}
              className='block min-w-0 whitespace-normal break-words font-medium'
            >
              {name}
            </ResourceLink>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{name}</TooltipContent>
        </Tooltip>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-mono text-xs text-foreground-muted'>{container.shortId}</span>
        <Visible when={container.managed}>
          <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>managed</span>
        </Visible>
        <Visible when={container.orphaned}>
          <span className='shrink-0 rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger'>orphaned</span>
        </Visible>
      </div>
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
    size: 360,
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
    size: 288,
    meta: { label: 'Image', skeleton: { kind: 'text', width: 'w-[84%]' } },
    cell: ({ row }) => (
      <ResourceLink
        href={`/runtime/images/${encodeURIComponent(row.original.imageId)}`}
        className='whitespace-normal break-words text-sm'
      >
        {row.original.image}
      </ResourceLink>
    )
  },
  {
    id: 'applicationId',
    accessorFn: container => container.applicationName ?? container.applicationId ?? '',
    header: 'Application',
    size: 208,
    meta: { label: 'Application', skeleton: { kind: 'stacked', primaryWidth: 'w-[68%]' } },
    cell: ({ row }) =>
      row.original.applicationId ? (
        <ApplicationReference
          id={row.original.applicationId}
          name={row.original.applicationName}
        />
      ) : (
        <span className='text-sm text-foreground-muted'>Unmanaged</span>
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
              <ResourceLink
                key={network}
                href={`/runtime/networks/${encodeURIComponent(network)}`}
                className='max-w-full whitespace-normal break-words'
              >
                {network}
              </ResourceLink>
            ))
          : 'none'}
      </div>
    )
  }
]

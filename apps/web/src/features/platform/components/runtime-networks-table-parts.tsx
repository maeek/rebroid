import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { ResourceLink } from '@/shared/ui/resource-link'
import type { PlatformNetwork } from '@/shared/contracts/platform'
import type { ColumnDef } from '@tanstack/react-table'

const NetworkNameCell = ({ network }: { network: PlatformNetwork }) => (
  <div className='flex min-w-0 flex-col gap-1.5'>
    <div className='flex min-w-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResourceLink
            href={`/runtime/networks/${network.id}`}
            className='block min-w-0 whitespace-normal break-words font-medium'
          >
            {network.name}
          </ResourceLink>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{network.name}</TooltipContent>
      </Tooltip>
    </div>
    <div className='flex flex-wrap items-center gap-2'>
      <span className='font-mono text-xs text-foreground-muted'>{network.shortId}</span>
      <Visible when={network.managed}>
        <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>managed</span>
      </Visible>
      <Visible when={network.internal}>
        <span className='shrink-0 rounded-full bg-surface-band px-2 py-0.5 text-xs text-foreground'>internal</span>
      </Visible>
    </div>
  </div>
)

export const createNetworkColumns = (): ColumnDef<PlatformNetwork>[] => [
  {
    id: 'name',
    accessorFn: network => network.name,
    header: 'Network',
    size: 352,
    meta: { label: 'Network', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => <NetworkNameCell network={row.original} />
  },
  {
    id: 'driver',
    accessorFn: network => network.driver,
    header: 'Driver',
    size: 128,
    meta: { label: 'Driver', skeleton: { kind: 'text', width: 'w-20' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.driver}</span>
  },
  {
    id: 'scope',
    accessorFn: network => network.scope,
    header: 'Scope',
    size: 112,
    meta: { label: 'Scope', skeleton: { kind: 'text', width: 'w-14' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.scope}</span>
  },
  {
    id: 'subnets',
    header: 'Subnet',
    size: 320,
    enableSorting: false,
    meta: { label: 'Subnet', skeleton: { kind: 'text', width: 'w-[76%]' } },
    cell: ({ row }) => (
      <div className='truncate text-sm text-foreground-muted'>
        {row.original.subnets.length > 0 ? row.original.subnets.join(', ') : 'none'}
      </div>
    )
  },
  {
    id: 'gateways',
    header: 'Gateway',
    size: 192,
    enableSorting: false,
    meta: { label: 'Gateway', skeleton: { kind: 'text', width: 'w-[72%]' } },
    cell: ({ row }) => (
      <div className='truncate text-sm text-foreground-muted'>
        {row.original.gateways.length > 0 ? row.original.gateways.join(', ') : 'none'}
      </div>
    )
  },
  {
    id: 'containers',
    accessorFn: network => network.containers.length,
    header: 'Containers',
    size: 128,
    meta: { label: 'Containers', skeleton: { kind: 'text', width: 'w-12' } },
    cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.containers.length}</span>
  }
]

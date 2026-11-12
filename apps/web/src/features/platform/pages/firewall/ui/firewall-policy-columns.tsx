import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { appResourceHref } from '@/shared/model/applications/app-resource-links'
import { ResourceLink } from '@/shared/ui/resource-link'
import {
  firewallAccessLabel,
  firewallAllowlistDisplay,
  firewallPolicyEnforcement
} from '../model/firewall-settings-model'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { ColumnDef } from '@tanstack/react-table'

const AllowlistBadges = ({ cidrs }: { cidrs: string[] }) => {
  const { empty, hiddenCidrs, visibleCidrs } = firewallAllowlistDisplay(cidrs)

  if (empty) return <span className='text-sm text-foreground-muted'>Managed destinations only</span>

  return (
    <div className='flex max-w-[24rem] flex-wrap gap-1'>
      {visibleCidrs.map(cidr => (
        <Badge
          key={cidr}
          variant='neutral'
        >
          {cidr}
        </Badge>
      ))}
      <Visible when={hiddenCidrs.length > 0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              aria-label={`${hiddenCidrs.length} more allowed ranges`}
            >
              +{hiddenCidrs.length}
            </Button>
          </TooltipTrigger>
          <TooltipContent className='max-w-sm break-all'>{hiddenCidrs.join(', ')}</TooltipContent>
        </Tooltip>
      </Visible>
    </div>
  )
}

export const firewallPolicyColumns: ColumnDef<AndroidApplication>[] = [
  {
    id: 'name',
    accessorFn: application => application.name,
    header: 'Application',
    size: 288,
    meta: { label: 'Application', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => (
      <div className='grid gap-1'>
        <ResourceLink
          className='truncate font-medium'
          href={appResourceHref(row.original.id, 'network')}
        >
          {row.original.name}
        </ResourceLink>
        <div className='truncate text-xs text-foreground-muted'>{row.original.id}</div>
      </div>
    )
  },
  {
    id: 'runtime',
    accessorFn: application => application.status.currentStatus,
    header: 'Runtime',
    size: 128,
    meta: { label: 'Runtime', skeleton: { kind: 'text', width: 'w-20' } },
    cell: ({ row }) => (
      <span className='capitalize text-sm text-foreground-muted'>{row.original.status.currentStatus}</span>
    )
  },
  {
    id: 'access',
    accessorFn: firewallAccessLabel,
    header: 'Outbound access',
    size: 228,
    meta: { label: 'Outbound access', skeleton: { kind: 'text', width: 'w-32' } }
  },
  {
    id: 'destinations',
    header: 'Destinations',
    size: 340,
    enableSorting: false,
    meta: { label: 'Destinations', skeleton: { kind: 'badge' } },
    cell: ({ row }) =>
      row.original.network.policy.enabled ? (
        <AllowlistBadges cidrs={row.original.network.policy.allowCidrs} />
      ) : (
        <span className='text-sm text-foreground-muted'>All destinations</span>
      )
  },
  {
    id: 'enforcement',
    accessorFn: application => firewallPolicyEnforcement(application).label,
    header: 'Firewall enforcement',
    size: 190,
    meta: { label: 'Firewall enforcement', skeleton: { kind: 'badge' } },
    cell: ({ row }) => {
      const state = firewallPolicyEnforcement(row.original)
      return (
        <StatusBadge
          tone={state.tone}
          title={state.description}
        >
          {state.label}
        </StatusBadge>
      )
    }
  }
]

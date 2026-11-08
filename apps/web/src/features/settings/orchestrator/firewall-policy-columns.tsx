import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { ResourceLink } from '@/shared/ui/resource-link'
import {
  firewallAllowlistDisplay,
  firewallPolicyResultDisplay,
  firewallRestrictionLabel
} from './firewall-settings-model'
import type { AndroidApplication } from '@/shared/contracts/application'
import type { ColumnDef } from '@tanstack/react-table'

const AllowlistBadges = ({ cidrs }: { cidrs: string[] }) => {
  const { empty, hiddenCidrs, visibleCidrs } = firewallAllowlistDisplay(cidrs)

  if (empty) return <span className='text-sm text-foreground-muted'>No custom CIDRs</span>

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

export const useFirewallPolicyColumns = ({
  disabled,
  onSetRestricted
}: {
  disabled: boolean
  onSetRestricted: (application: AndroidApplication, enabled: boolean) => Promise<void>
}): ColumnDef<AndroidApplication>[] =>
  useMemo(
    () => [
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
              href={`/app/${row.original.id}?view=configuration`}
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
        id: 'allowlist',
        header: 'Allowlist',
        size: 416,
        enableSorting: false,
        meta: { label: 'Allowlist', skeleton: { kind: 'badge' } },
        cell: ({ row }) => <AllowlistBadges cidrs={row.original.network.policy.allowCidrs} />
      },
      {
        id: 'result',
        accessorFn: application => application.network.policy.result?.code ?? application.network.policy.status ?? '',
        header: 'Result',
        size: 176,
        meta: { label: 'Result', skeleton: { kind: 'badge' } },
        cell: ({ row }) => {
          const result = firewallPolicyResultDisplay(row.original)
          return (
            <Badge
              className='capitalize'
              variant={result.variant}
            >
              {result.label}
            </Badge>
          )
        }
      },
      {
        id: 'restricted',
        accessorFn: application => application.network.policy.enabled,
        header: 'Restricted',
        size: 176,
        meta: { label: 'Restricted', skeleton: { kind: 'text', width: 'w-20' } },
        cell: ({ row }) => {
          const label = firewallRestrictionLabel(row.original)
          return (
            <div className='flex items-center gap-2'>
              <span className='text-xs text-foreground-muted'>{label}</span>
              <Switch
                checked={row.original.network.policy.enabled}
                disabled={disabled}
                aria-label={`${row.original.network.policy.enabled ? 'Disable' : 'Enable'} restricted network access for ${row.original.name}`}
                onCheckedChange={checked => void onSetRestricted(row.original, checked)}
              />
            </div>
          )
        }
      }
    ],
    [disabled, onSetRestricted]
  )

import { useMemo } from 'react'
import { IconPencil, IconSparkles, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderStatusBadge } from './provider-status-badge'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'
import type { ColumnDef } from '@tanstack/react-table'

export const ProvidersGrid = ({
  providers,
  busyId,
  onEdit,
  onDelete
}: {
  providers: AutomationAiProvider[]
  busyId: string | null
  onEdit: (provider: AutomationAiProvider) => void
  onDelete: (provider: AutomationAiProvider) => void
}) => {
  const columns = useMemo<ColumnDef<AutomationAiProvider>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Provider',
        size: 260,
        meta: { label: 'Provider' },
        cell: ({ row }) => (
          <div className='flex min-h-10 min-w-0 flex-col justify-center'>
            <Link
              href={`/orchestrator/ai-providers/${encodeURIComponent(row.original.id)}`}
              className='block truncate font-medium hover:text-primary'
            >
              {row.original.label}
            </Link>
            <div className='truncate text-xs text-secondary-foreground'>{row.original.id}</div>
          </div>
        )
      },
      {
        accessorKey: 'kind',
        header: 'Kind',
        size: 170,
        meta: { label: 'Kind' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <Badge variant='secondary'>{row.original.kind}</Badge>
          </div>
        )
      },
      {
        accessorKey: 'baseUrl',
        header: 'Base URL',
        size: 320,
        meta: { label: 'Base URL' },
        cell: ({ row }) => (
          <div className='flex min-h-10 min-w-0 items-center'>
            <span className='block truncate font-mono text-xs'>{row.original.baseUrl}</span>
          </div>
        )
      },
      {
        id: 'models',
        header: 'Models',
        size: 300,
        meta: { label: 'Models' },
        cell: ({ row }) => (
          <div className='flex min-h-10 min-w-0 items-center'>
            <div className='flex min-w-0 flex-wrap items-center gap-1'>
              {row.original.models.slice(0, 3).map(model => (
                <Badge
                  key={model.id}
                  variant={model.enabled ? 'outline' : 'secondary'}
                  className='max-w-full truncate'
                >
                  {model.default ? `${model.label} default` : model.label}
                </Badge>
              ))}
              {row.original.models.length > 3 ? (
                <Badge variant='secondary'>+{row.original.models.length - 3}</Badge>
              ) : null}
            </div>
          </div>
        )
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        size: 140,
        meta: { label: 'Status' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <ProviderStatusBadge enabled={row.original.enabled} />
          </div>
        )
      },
      {
        id: 'health',
        header: 'Health',
        size: 150,
        meta: { label: 'Health' },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <ProviderHealthBadge provider={row.original} />
          </div>
        )
      }
    ],
    []
  )

  return (
    <Section contentClassName='gap-4'>
      <DataGrid
        columns={columns}
        data={providers}
        totalItems={providers.length}
        pageIndex={0}
        pageSize={Math.max(providers.length, 1)}
        getRowId={provider => provider.id}
        minWidth='74rem'
        emptyState={<div className='text-center text-secondary-foreground'>No AI providers configured.</div>}
        mobileCard={row => <ProviderMobileCard provider={row.original} />}
        rowContextMenu={row => {
          const provider = row.original
          return (
            <>
              <ContextMenuItem onSelect={() => onEdit(provider)}>
                <IconPencil className='mr-2 size-4' />
                Edit
              </ContextMenuItem>
              <ContextMenuItem
                disabled={busyId === provider.id}
                onSelect={() => onDelete(provider)}
              >
                <IconTrash className='mr-2 size-4' />
                Delete
              </ContextMenuItem>
            </>
          )
        }}
      />
    </Section>
  )
}

const ProviderMobileCard = ({ provider }: { provider: AutomationAiProvider }) => (
  <div className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4 pr-12'>
    <div className='flex min-w-0 items-start gap-3'>
      <div className='flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary'>
        <IconSparkles className='size-5' />
      </div>
      <div className='min-w-0 flex-1'>
        <Link
          href={`/orchestrator/ai-providers/${encodeURIComponent(provider.id)}`}
          className='block truncate font-medium hover:text-primary'
        >
          {provider.label}
        </Link>
        <div className='truncate text-xs text-secondary-foreground'>{provider.baseUrl}</div>
      </div>
      <ProviderStatusBadge enabled={provider.enabled} />
    </div>
    <ProviderHealthBadge
      provider={provider}
      compact
    />
    <div className='flex flex-wrap gap-1'>
      {provider.models.map(model => (
        <Badge
          key={model.id}
          variant={model.enabled ? 'outline' : 'secondary'}
        >
          {model.default ? `${model.label} default` : model.label}
        </Badge>
      ))}
    </div>
  </div>
)

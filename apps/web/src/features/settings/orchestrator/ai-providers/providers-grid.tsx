import { useMemo } from 'react'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { DataGrid } from '@/shared/ui/data-grid'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderStatusBadge } from './provider-status-badge'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'
import type { ColumnDef } from '@tanstack/react-table'

export const ProvidersGrid = ({
  providers,
  busyId,
  selectedIds,
  onSelectedIdsChange,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
  onEdit,
  onDelete
}: {
  providers: AutomationAiProvider[]
  busyId: string | null
  selectedIds: Set<string>
  onSelectedIdsChange: (selectedIds: Set<string>) => void
  onEnableSelected: () => void
  onDisableSelected: () => void
  onDeleteSelected: () => void
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
      {selectedIds.size > 0 ? (
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-sm text-secondary-foreground'>{selectedIds.size} selected</span>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='secondary'
              disabled={busyId === 'bulk'}
              onClick={onEnableSelected}
            >
              Enable selected
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={busyId === 'bulk'}
              onClick={onDisableSelected}
            >
              Disable selected
            </Button>
            <Button
              type='button'
              variant='ghost'
              disabled={busyId === 'bulk'}
              onClick={onDeleteSelected}
            >
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}
      <DataGrid
        columns={columns}
        data={providers}
        totalItems={providers.length}
        pageIndex={0}
        pageSize={Math.max(providers.length, 1)}
        getRowId={provider => provider.id}
        selection={{ selectedIds, onSelectedIdsChange }}
        minWidth='74rem'
        emptyState={<div className='text-center text-secondary-foreground'>No AI providers configured.</div>}
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

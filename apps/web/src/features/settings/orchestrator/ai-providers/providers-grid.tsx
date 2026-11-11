import { useMemo, useState } from 'react'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { aiProviderKindLabel } from '@/shared/model/ai-model-catalog'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { ResourceLink } from '@/shared/ui/resource-link'
import { ProviderHealthBadge } from './provider-health-badge'
import { ProviderStatusBadge } from './provider-status-badge'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'
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
  onDelete,
  loading = false
}: {
  loading?: boolean
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
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const columns = useMemo<ColumnDef<AutomationAiProvider>[]>(
    () => [
      {
        accessorKey: 'label',
        header: 'Provider',
        size: 260,
        meta: { label: 'Provider', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='flex min-h-10 min-w-0 flex-col justify-center'>
            <ResourceLink
              href={`/platform/ai/${encodeURIComponent(row.original.id)}`}
              className='block truncate font-medium'
            >
              {row.original.label}
            </ResourceLink>
            <div className='truncate text-xs text-foreground-muted'>{row.original.id}</div>
          </div>
        )
      },
      {
        accessorKey: 'baseUrl',
        header: 'Connection',
        size: 320,
        meta: { label: 'Connection', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid min-w-0 gap-1'>
            <span
              className='truncate text-sm'
              title={row.original.baseUrl}
            >
              {row.original.baseUrl}
            </span>
            <span className='text-xs text-foreground-muted'>{aiProviderKindLabel(row.original.kind)}</span>
          </div>
        )
      },
      {
        id: 'models',
        header: 'Models',
        size: 220,
        meta: { label: 'Models', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <span className='text-sm'>{row.original.models.length} configured</span>
            <span className='text-xs text-foreground-muted'>
              {row.original.models.filter(model => model.enabled).length} enabled
            </span>
          </div>
        )
      },
      {
        accessorKey: 'enabled',
        header: 'Status',
        size: 140,
        meta: { label: 'Status', skeleton: { kind: 'badge' } },
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
        meta: { label: 'Health', skeleton: { kind: 'badge' } },
        cell: ({ row }) => (
          <div className='flex min-h-10 items-center'>
            <ProviderHealthBadge provider={row.original} />
          </div>
        )
      }
    ],
    []
  )
  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return providers
    return providers.filter(provider =>
      `${provider.label} ${provider.id} ${provider.baseUrl} ${provider.models.map(model => `${model.label} ${model.id}`).join(' ')}`
        .toLowerCase()
        .includes(query)
    )
  }, [providers, search])

  return (
    <Section
      surface='plain'
      title='Providers'
      description='Manage connections, registered models, and defaults for each provider.'
      contentClassName='gap-4'
    >
      <DataGridWorkspace
        disabled={loading}
        search={searchDraft}
        searchPlaceholder='Search AI providers'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        selectedCount={selectedIds.size}
        bulkActions={
          <>
            <Button
              type='button'
              variant='ghost'
              disabled={busyId === 'bulk'}
              onClick={onEnableSelected}
            >
              Enable selected
            </Button>
            <Button
              type='button'
              variant='ghost'
              disabled={busyId === 'bulk'}
              onClick={onDisableSelected}
            >
              Disable selected
            </Button>
            <Button
              type='button'
              variant='danger-ghost'
              disabled={busyId === 'bulk'}
              onClick={onDeleteSelected}
            >
              Delete selected
            </Button>
          </>
        }
      >
        <DataGrid
          columns={columns}
          data={visibleProviders}
          totalItems={visibleProviders.length}
          pageIndex={0}
          pageSize={Math.max(visibleProviders.length, 1)}
          getRowId={provider => provider.id}
          selection={{ selectedIds, onSelectedIdsChange }}
          minWidth='58rem'
          loading={loading ? { rowCount: 5 } : false}
          emptyState={
            <DataGridEmptyState
              title='No providers configured'
              description='Add a provider to connect your models.'
            />
          }
          rowContextMenu={row => {
            const provider = row.original
            return (
              <>
                <ContextMenuItem onSelect={() => onEdit(provider)}>
                  <IconPencil className='mr-2 size-4' />
                  Edit
                </ContextMenuItem>
                <ContextMenuItem
                  className='text-danger focus:text-danger'
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
      </DataGridWorkspace>
    </Section>
  )
}

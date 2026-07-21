import { useMemo, useState } from 'react'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { aiModelRoleLabel } from '@/shared/model/ai-model-catalog'
import { AiProviderKindBadge } from '@/shared/ui/ai/ai-model-badges'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
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
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
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
              href={`/platform/ai/${encodeURIComponent(row.original.id)}`}
              className='block truncate font-medium hover:text-primary'
            >
              {row.original.label}
            </Link>
            <div className='truncate text-xs text-foreground-muted'>{row.original.id}</div>
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
            <AiProviderKindBadge kind={row.original.kind} />
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
                  variant={model.enabled ? 'outline' : 'neutral'}
                  className='max-w-full truncate'
                >
                  {model.defaultFor.length > 0
                    ? `${model.label} ${model.defaultFor.map(aiModelRoleLabel).join('/')} default`
                    : model.label}
                </Badge>
              ))}
              {row.original.models.length > 3 ? (
                <Badge variant='neutral'>+{row.original.models.length - 3}</Badge>
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
  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return providers
    return providers.filter(provider =>
      `${provider.label} ${provider.id} ${provider.baseUrl} ${provider.models.map(model => model.label).join(' ')}`
        .toLowerCase()
        .includes(query)
    )
  }, [providers, search])

  return (
    <Section
      surface='plain'
      contentClassName='gap-4'
    >
      <DataGridWorkspace
        search={searchDraft}
        searchPlaceholder='Search AI providers'
        onSearchChange={setSearchDraft}
        onSearch={setSearch}
        selectedCount={selectedIds.size}
        bulkActions={
          <>
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
              variant='danger'
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
          minWidth='74rem'
          emptyState={
            <div className='flex items-center justify-center gap-2 text-center text-foreground-muted'>
              <GradientSparklesIcon className='size-4' />
              No AI configured.
            </div>
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

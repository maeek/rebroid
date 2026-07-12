'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { DataGrid, DataGridPagination, DataGridWorkspace } from '@/shared/ui/data-grid'
import { RuntimeNetworkFilters } from './runtime-grid-filter-controls'
import {
  platformSortFromSearchParam,
  platformSortToSearchParam,
  retainVisiblePlatformSelection,
  selectedPlatformItemsFromIds
} from './runtime-grid-query-utils'
import {
  buildNetworksGridHref,
  canRemoveSelectedNetworks,
  networkHasAttachedContainers,
  summarizeNetworkRemoveResults
} from './runtime-networks-section-model'
import type {
  PlatformNetwork,
  PlatformNetworksGridPage,
  PlatformNetworksGridQuery
} from '@/server/orchestrator/platform/types'
import type { ColumnDef } from '@tanstack/react-table'

const NetworkNameCell = ({ network, className }: { network: PlatformNetwork; className?: string }) => (
  <div className={className ?? 'flex min-w-[16rem] flex-col gap-1'}>
    <div className='flex min-w-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/runtime/networks/${network.id}`}
            className='block min-w-0 truncate font-medium hover:text-primary'
          >
            {network.name}
          </Link>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm break-all'>{network.name}</TooltipContent>
      </Tooltip>
      <Visible when={network.managed}>
        <span className='shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary'>managed</span>
      </Visible>
      <Visible when={network.internal}>
        <span className='shrink-0 rounded-full bg-surface-band px-2 py-0.5 text-xs text-foreground'>internal</span>
      </Visible>
    </div>
    <div className='truncate text-xs text-foreground-muted'>{network.shortId}</div>
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

export const RuntimeNetworksSection = ({
  networksPage,
  gridQuery
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingRemove, setPendingRemove] = useState<PlatformNetwork[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(() => platformSortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisiblePlatformSelection(networksPage.items, current))
  }, [networksPage.items])

  const selectedNetworks = selectedPlatformItemsFromIds(networksPage.items, selectedIds)

  const pushGridParams = (patch: Partial<PlatformNetworksGridQuery>) => {
    router.replace(buildNetworksGridHref({ gridQuery, pageSize: networksPage.pageSize, patch }), { scroll: false })
  }

  const removeNetworks = async () => {
    if (!pendingRemove?.length) return

    setBusyId(pendingRemove.length === 1 ? pendingRemove[0].id : 'bulk')
    try {
      const results = await Promise.all(pendingRemove.map(network => removePlatformNetworkAction(network.id)))
      if (pendingRemove.length === 1) {
        unwrapActionResult(results[0])
        toast({ title: 'Network removed', variant: 'success' })
      } else {
        toast(summarizeNetworkRemoveResults(results))
        setSelectedIds(new Set())
      }
      setPendingRemove(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove network',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo(() => createNetworkColumns(), [])
  const activeFilters = [
    ...(gridQuery.ownership === 'all'
      ? [
          {
            id: 'ownership',
            label: 'Ownership',
            value: 'All Docker',
            onRemove: () => pushGridParams({ ownership: 'managed', page: 1 })
          }
        ]
      : []),
    ...(gridQuery.driver
      ? [
          {
            id: 'driver',
            label: 'Driver',
            value: gridQuery.driver,
            onRemove: () => pushGridParams({ driver: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.dockerScope
      ? [
          {
            id: 'dockerScope',
            label: 'Scope',
            value: gridQuery.dockerScope,
            onRemove: () => pushGridParams({ dockerScope: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.trait && gridQuery.trait !== 'all'
      ? [
          {
            id: 'trait',
            label: 'Characteristic',
            value: gridQuery.trait,
            onRemove: () => pushGridParams({ trait: 'all', page: 1 })
          }
        ]
      : []),
    ...(gridQuery.attachment && gridQuery.attachment !== 'all'
      ? [
          {
            id: 'attachment',
            label: 'Containers',
            value: gridQuery.attachment,
            onRemove: () => pushGridParams({ attachment: 'all', page: 1 })
          }
        ]
      : [])
  ]

  return (
    <>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search networks'
          onSearchChange={setSearch}
          onSearch={value => pushGridParams({ q: value.trim() || undefined, page: 1 })}
          filters={
            <RuntimeNetworkFilters
              page={networksPage}
              query={gridQuery}
              onUpdate={pushGridParams}
            />
          }
          filterTitle='Filter networks'
          filterDescription='Narrow networks by Docker properties and attached resources.'
          activeFilters={activeFilters}
          onResetFilters={() =>
            pushGridParams({
              ownership: 'managed',
              driver: undefined,
              dockerScope: undefined,
              trait: 'all',
              attachment: 'all',
              page: 1
            })
          }
          selectedCount={selectedNetworks.length}
          bulkActions={
            <Button
              type='button'
              variant='danger'
              disabled={busyId === 'bulk' || !canRemoveSelectedNetworks(selectedNetworks)}
              onClick={() => setPendingRemove(selectedNetworks)}
            >
              Remove selected
            </Button>
          }
        >
          <TooltipProvider delayDuration={150}>
            <DataGrid
              columns={columns}
              data={networksPage.items}
              totalItems={networksPage.total}
              pageIndex={networksPage.page - 1}
              pageSize={networksPage.pageSize}
              getRowId={network => network.id}
              sorting={sorting}
              onSortingChange={updater => {
                const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
                pushGridParams({ sort: platformSortToSearchParam(nextSorting), page: 1 })
              }}
              selection={{
                selectedIds,
                onSelectedIdsChange: setSelectedIds
              }}
              emptyState={
                <div className='text-center text-foreground-muted'>
                  {gridQuery.q ? 'No networks match this search.' : 'No networks are visible to Docker.'}
                </div>
              }
              rowContextMenu={row => {
                const hasBulkSelection = selectedIds.has(row.original.id) && selectedNetworks.length > 1
                return (
                  <>
                    {hasBulkSelection ? (
                      <ContextMenuItem
                        className='text-danger focus:text-danger'
                        disabled={busyId === 'bulk' || !canRemoveSelectedNetworks(selectedNetworks)}
                        onSelect={() => setPendingRemove(selectedNetworks)}
                      >
                        <IconTrash className='mr-2 size-4' />
                        Remove selected ({selectedNetworks.length})
                      </ContextMenuItem>
                    ) : null}
                    <ContextMenuItem asChild>
                      <Link href={`/runtime/networks/${row.original.id}`}>
                        <IconEye className='mr-2 size-4' />
                        Details
                      </Link>
                    </ContextMenuItem>
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      disabled={networkHasAttachedContainers(row.original)}
                      onSelect={() => setPendingRemove([row.original])}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Remove
                    </ContextMenuItem>
                  </>
                )
              }}
            />
          </TooltipProvider>

          <DataGridPagination
            totalItems={networksPage.total}
            pageIndex={networksPage.page - 1}
            pageSize={networksPage.pageSize}
            onPageIndexChange={pageIndex => pushGridParams({ page: pageIndex + 1 })}
            onPageSizeChange={pageSize => pushGridParams({ page: 1, pageSize })}
          />
        </DataGridWorkspace>
      </Section>

      <ConfirmMutationDialog
        open={Boolean(pendingRemove)}
        title={pendingRemove?.length === 1 ? 'Remove network?' : `Remove ${pendingRemove?.length ?? 0} networks?`}
        description='This permanently removes the selected network configuration from Docker.'
        summary={pendingRemove?.length === 1 ? pendingRemove[0]?.name : undefined}
        consequence='Networks with attached containers cannot be removed.'
        confirmLabel={pendingRemove?.length === 1 ? 'Remove network' : 'Remove networks'}
        pendingLabel='Removing…'
        pending={busyId !== null}
        onOpenChange={open => {
          if (!open) setPendingRemove(null)
        }}
        onConfirm={() => void removeNetworks()}
      />
    </>
  )
}

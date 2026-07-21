'use client'

import { useMemo } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useRuntimeNetworkActions } from '../hooks/use-runtime-network-actions'
import { useRuntimeResourceGridController } from '../hooks/use-runtime-resource-grid-controller'
import { RuntimeNetworkFilters } from './runtime-grid-filter-controls'
import { platformSortFromSearchParam } from './runtime-grid-query-utils'
import {
  buildNetworksGridHref,
  canRemoveSelectedNetworks,
  networkHasAttachedContainers
} from './runtime-networks-section-model'
import { createNetworkColumns } from './runtime-networks-table-parts'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/shared/contracts/platform'

const networkId = (network: PlatformNetworksGridPage['items'][number]) => network.id

export const RuntimeNetworksSection = ({
  networksPage,
  gridQuery
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
}) => {
  const {
    search,
    setSearch,
    selectedIds,
    setSelectedIds,
    selectedItems: selectedNetworks,
    sorting,
    pushGridParams,
    onSearch,
    onSortingChange,
    onPageIndexChange,
    onPageSizeChange,
    clearSelection,
    refresh
  } = useRuntimeResourceGridController({
    items: networksPage.items,
    gridQuery,
    pageSize: networksPage.pageSize,
    getItemId: networkId,
    parseSort: platformSortFromSearchParam,
    buildHref: buildNetworksGridHref
  })
  const { pendingRemove, setPendingRemove, busyId, removeNetworks } = useRuntimeNetworkActions({
    clearSelection,
    refresh
  })

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
          onSearch={onSearch}
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
              onSortingChange={onSortingChange}
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
            onPageIndexChange={onPageIndexChange}
            onPageSizeChange={onPageSizeChange}
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

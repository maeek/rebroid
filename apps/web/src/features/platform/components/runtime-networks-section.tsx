'use client'

import { useMemo } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { parsePlatformInventorySort } from '@/shared/model/platform-inventory-sort'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useResourceGridController } from '@/shared/ui/data-grid/use-resource-grid-controller'
import { useRuntimeNetworkActions } from '../hooks/use-runtime-network-actions'
import { RuntimeNetworkFilters } from './runtime-grid-filter-controls'
import {
  buildNetworksGridHref,
  canRemoveSelectedNetworks,
  networkHasAttachedContainers
} from './runtime-networks-section-model'
import { createNetworkColumns } from './runtime-networks-table-parts'
import type { PlatformNetworksGridPage, PlatformNetworksGridQuery } from '@/shared/contracts/platform'

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
    query,
    isNavigating,
    selectedIds,
    setSelectedIds,
    selectedItems: selectedNetworks,
    sorting,
    pushGridParams,
    onSearch,
    onSortingChange,
    onPageIndexChange,
    onPageSizeChange,
    deselectItems,
    refresh
  } = useResourceGridController({
    items: networksPage.items,
    gridQuery,
    pageSize: networksPage.pageSize,
    parseSort: sort => parsePlatformInventorySort('networks', sort),
    buildHref: buildNetworksGridHref
  })
  const { pendingRemove, setPendingRemove, busyId, removeNetworks } = useRuntimeNetworkActions({
    deselectItems,
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
          updating={isNavigating}
          columnsInToolbar
          search={search}
          appliedSearch={gridQuery.q ?? ''}
          searchPlaceholder='Search networks'
          onSearchChange={setSearch}
          onSearch={onSearch}
          filters={
            <RuntimeNetworkFilters
              page={networksPage}
              query={query}
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
              variant='danger-ghost'
              disabled={busyId === 'bulk' || !canRemoveSelectedNetworks(selectedNetworks)}
              onClick={() => setPendingRemove(selectedNetworks)}
            >
              Remove selected
            </Button>
          }
        >
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
              <DataGridEmptyState
                title='No networks'
                description='No networks are available in the current Docker inventory.'
              />
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
                      <IconTrash className='size-4' />
                      Remove selected ({selectedNetworks.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/runtime/networks/${row.original.id}`}>
                      <IconEye className='size-4' />
                      Details
                    </Link>
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-danger focus:text-danger'
                    disabled={networkHasAttachedContainers(row.original)}
                    onSelect={() => setPendingRemove([row.original])}
                  >
                    <IconTrash className='size-4' />
                    Remove
                  </ContextMenuItem>
                </>
              )
            }}
          />

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
        title={
          pendingRemove?.length === 1
            ? `Remove “${pendingRemove[0]?.name}”?`
            : `Remove ${pendingRemove?.length ?? 0} networks?`
        }
        description='Permanently remove these network settings from Docker. Docker requires you to detach any containers first.'
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

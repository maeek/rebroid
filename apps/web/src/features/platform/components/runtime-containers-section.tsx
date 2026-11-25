'use client'

import { useMemo } from 'react'
import { IconEye, IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { Visible } from '@/components/ui/visible'
import { parsePlatformInventorySort } from '@/shared/model/platform-inventory-sort'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useResourceGridController } from '@/shared/ui/data-grid/use-resource-grid-controller'
import { useRuntimeContainerActions } from '../hooks/use-runtime-container-actions'
import {
  buildContainersGridHref,
  canRunBulkContainerAction,
  selectVisibleOrphanedContainerIds
} from './runtime-containers-section-model'
import { createContainerColumns } from './runtime-containers-table-parts'
import { RuntimeContainerFilters } from './runtime-grid-filter-controls'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/shared/contracts/platform'

export const RuntimeContainersSection = ({
  containersPage,
  gridQuery
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
}) => {
  const {
    search,
    setSearch,
    query,
    isNavigating,
    selectedIds,
    setSelectedIds,
    selectedItems: selectedContainers,
    sorting,
    pushGridParams,
    onSearch,
    onSortingChange,
    onPageIndexChange,
    onPageSizeChange,
    deselectItems,
    refresh
  } = useResourceGridController({
    items: containersPage.items,
    gridQuery,
    pageSize: containersPage.pageSize,
    parseSort: sort => parsePlatformInventorySort('containers', sort),
    buildHref: buildContainersGridHref
  })
  const {
    pendingAction,
    setPendingAction,
    pendingBulkAction,
    setPendingBulkAction,
    busyId,
    runContainerAction,
    runBulkAction
  } = useRuntimeContainerActions({ selectedContainers, deselectItems, refresh })

  const selectVisibleOrphaned = () => {
    setSelectedIds(selectVisibleOrphanedContainerIds(containersPage.items, selectedIds))
  }

  const columns = useMemo(() => createContainerColumns(), [])
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
    ...(gridQuery.state
      ? [
          {
            id: 'state',
            label: 'State',
            value: gridQuery.state,
            onRemove: () => pushGridParams({ state: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.application
      ? [
          {
            id: 'application',
            label: 'Application',
            value: containersPage.facets.applicationNames?.[gridQuery.application] ?? gridQuery.application,
            onRemove: () => pushGridParams({ application: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.image
      ? [
          {
            id: 'image',
            label: 'Image',
            value: gridQuery.image,
            onRemove: () => pushGridParams({ image: undefined, page: 1 })
          }
        ]
      : []),
    ...(gridQuery.network
      ? [
          {
            id: 'network',
            label: 'Network',
            value: gridQuery.network,
            onRemove: () => pushGridParams({ network: undefined, page: 1 })
          }
        ]
      : [])
  ]

  const resetFilters = () =>
    pushGridParams({
      ownership: 'managed',
      state: undefined,
      application: undefined,
      image: undefined,
      network: undefined,
      page: 1
    })

  return (
    <>
      <Section
        surface='plain'
        contentClassName='gap-4'
      >
        <Visible when={containersPage.orphanedCount > 0}>
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/(--feedback-border-opacity) bg-danger/10 p-3 text-sm'>
            <span className='text-danger'>
              {containersPage.orphanedCount} managed Rebroid container
              {containersPage.orphanedCount === 1 ? '' : 's'} no longer have an app record.
            </span>
            <Button
              type='button'
              variant='danger'
              disabled={busyId === 'bulk'}
              onClick={selectVisibleOrphaned}
            >
              Select visible orphaned
            </Button>
          </div>
        </Visible>

        <DataGridWorkspace
          updating={isNavigating}
          columnsInToolbar
          search={search}
          appliedSearch={gridQuery.q ?? ''}
          searchPlaceholder='Search containers'
          onSearchChange={setSearch}
          onSearch={onSearch}
          filters={
            <RuntimeContainerFilters
              page={containersPage}
              query={query}
              onUpdate={pushGridParams}
            />
          }
          filterTitle='Filter containers'
          filterDescription='Narrow the Docker inventory by lifecycle and resource relationships.'
          activeFilters={activeFilters}
          onResetFilters={resetFilters}
          selectedCount={selectedContainers.length}
          bulkActions={
            <>
              <Button
                type='button'
                variant='ghost'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => setPendingBulkAction('stop')}
              >
                Stop selected
              </Button>
              <Button
                type='button'
                variant='danger-ghost'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => setPendingBulkAction('remove')}
              >
                Remove selected
              </Button>
            </>
          }
        >
          <DataGrid
            columns={columns}
            data={containersPage.items}
            totalItems={containersPage.total}
            pageIndex={containersPage.page - 1}
            pageSize={containersPage.pageSize}
            getRowId={container => container.id}
            sorting={sorting}
            onSortingChange={onSortingChange}
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            emptyState={
              <DataGridEmptyState
                artwork='inventory'
                artworkSize='page'
                title='No containers'
                description='No containers are available in the current Docker inventory.'
              />
            }
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedContainers.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <>
                      <ContextMenuItem
                        disabled={busyId === 'bulk'}
                        onSelect={() => setPendingBulkAction('stop')}
                      >
                        <IconPlayerStopFilled className='size-4' />
                        Stop selected ({selectedContainers.length})
                      </ContextMenuItem>
                      <ContextMenuItem
                        className='text-danger focus:text-danger'
                        disabled={busyId === 'bulk'}
                        onSelect={() => setPendingBulkAction('remove')}
                      >
                        <IconTrash className='size-4' />
                        Remove selected ({selectedContainers.length})
                      </ContextMenuItem>
                    </>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/runtime/containers/${row.original.id}`}>
                      <IconEye className='size-4' />
                      Details
                    </Link>
                  </ContextMenuItem>
                  {row.original.applicationId && !row.original.orphaned ? (
                    <ContextMenuItem asChild>
                      <Link href={`/apps/${row.original.applicationId}?logs=1`}>
                        <IconTerminal2 className='size-4' />
                        Logs
                      </Link>
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem
                    disabled={row.original.state !== 'running'}
                    onSelect={() => setPendingAction({ type: 'stop', container: row.original })}
                  >
                    <IconPlayerStopFilled className='size-4' />
                    Stop
                  </ContextMenuItem>
                  <ContextMenuItem
                    className='text-danger focus:text-danger'
                    onSelect={() => setPendingAction({ type: 'remove', container: row.original })}
                  >
                    <IconTrash className='size-4' />
                    Remove
                  </ContextMenuItem>
                </>
              )
            }}
          />

          <DataGridPagination
            totalItems={containersPage.total}
            pageIndex={containersPage.page - 1}
            pageSize={containersPage.pageSize}
            onPageIndexChange={onPageIndexChange}
            onPageSizeChange={onPageSizeChange}
          />
        </DataGridWorkspace>
      </Section>

      <ConfirmMutationDialog
        open={Boolean(pendingAction)}
        title={`${pendingAction?.type === 'stop' ? 'Stop' : 'Remove'} “${pendingAction?.container.names[0] ?? pendingAction?.container.shortId}”?`}
        description={
          pendingAction?.type === 'stop'
            ? 'The Docker container stops and remains available to start again.'
            : 'Permanently delete the Docker container and its writable data. Persistent volumes are kept.'
        }
        tone={pendingAction?.type === 'stop' ? 'warning' : 'danger'}
        confirmLabel={pendingAction?.type === 'stop' ? 'Stop container' : 'Remove container'}
        pendingLabel={pendingAction?.type === 'stop' ? 'Stopping…' : 'Removing…'}
        pending={Boolean(pendingAction && busyId === pendingAction.container.id)}
        onOpenChange={open => {
          if (!open) setPendingAction(null)
        }}
        onConfirm={() => void runContainerAction()}
      />
      <ConfirmMutationDialog
        open={Boolean(pendingBulkAction)}
        title={`${pendingBulkAction === 'stop' ? 'Stop' : 'Remove'} ${selectedContainers.length} containers?`}
        description={
          pendingBulkAction === 'stop'
            ? 'Stop every running container in the selection.'
            : 'Permanently delete eligible containers in the selection and their writable data. Persistent volumes are kept.'
        }
        tone={pendingBulkAction === 'stop' ? 'warning' : 'danger'}
        confirmLabel={pendingBulkAction === 'stop' ? 'Stop containers' : 'Remove containers'}
        pendingLabel={pendingBulkAction === 'stop' ? 'Stopping…' : 'Removing…'}
        pending={busyId === 'bulk'}
        onOpenChange={open => {
          if (!open) setPendingBulkAction(null)
        }}
        onConfirm={() => {
          if (pendingBulkAction) void runBulkAction(pendingBulkAction)
        }}
      />
    </>
  )
}

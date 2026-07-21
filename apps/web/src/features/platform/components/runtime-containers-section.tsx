'use client'

import { useMemo } from 'react'
import { IconEye, IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { useRuntimeContainerActions } from '../hooks/use-runtime-container-actions'
import { useRuntimeResourceGridController } from '../hooks/use-runtime-resource-grid-controller'
import {
  buildContainersGridHref,
  canRunBulkContainerAction,
  selectVisibleOrphanedContainerIds
} from './runtime-containers-section-model'
import { createContainerColumns } from './runtime-containers-table-parts'
import { RuntimeContainerFilters } from './runtime-grid-filter-controls'
import { platformSortFromSearchParam } from './runtime-grid-query-utils'
import type { PlatformContainersGridPage, PlatformContainersGridQuery } from '@/shared/contracts/platform'

const containerId = (container: PlatformContainersGridPage['items'][number]) => container.id

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
    selectedIds,
    setSelectedIds,
    selectedItems: selectedContainers,
    sorting,
    pushGridParams,
    onSearch,
    onSortingChange,
    onPageIndexChange,
    onPageSizeChange,
    clearSelection,
    refresh
  } = useRuntimeResourceGridController({
    items: containersPage.items,
    gridQuery,
    pageSize: containersPage.pageSize,
    getItemId: containerId,
    parseSort: platformSortFromSearchParam,
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
  } = useRuntimeContainerActions({ selectedContainers, clearSelection, refresh })

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
            value: gridQuery.application,
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
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/35 bg-danger/10 p-3 text-sm'>
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
          search={search}
          searchPlaceholder='Search containers'
          onSearchChange={setSearch}
          onSearch={onSearch}
          filters={
            <RuntimeContainerFilters
              page={containersPage}
              query={gridQuery}
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
                variant='secondary'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => setPendingBulkAction('stop')}
              >
                Stop selected
              </Button>
              <Button
                type='button'
                variant='danger'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => setPendingBulkAction('remove')}
              >
                Remove selected
              </Button>
            </>
          }
        >
          <TooltipProvider delayDuration={150}>
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
                <div className='text-center text-foreground-muted'>
                  {gridQuery.q ? 'No containers match this search.' : 'No containers are visible to Docker.'}
                </div>
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
                          <IconPlayerStopFilled className='mr-2 size-4' />
                          Stop selected ({selectedContainers.length})
                        </ContextMenuItem>
                        <ContextMenuItem
                          className='text-danger focus:text-danger'
                          disabled={busyId === 'bulk'}
                          onSelect={() => setPendingBulkAction('remove')}
                        >
                          <IconTrash className='mr-2 size-4' />
                          Remove selected ({selectedContainers.length})
                        </ContextMenuItem>
                      </>
                    ) : null}
                    <ContextMenuItem asChild>
                      <Link href={`/runtime/containers/${row.original.id}`}>
                        <IconEye className='mr-2 size-4' />
                        Details
                      </Link>
                    </ContextMenuItem>
                    {row.original.applicationId && !row.original.orphaned ? (
                      <ContextMenuItem asChild>
                        <Link href={`/app/${row.original.applicationId}?logs=1`}>
                          <IconTerminal2 className='mr-2 size-4' />
                          Logs
                        </Link>
                      </ContextMenuItem>
                    ) : null}
                    <ContextMenuItem
                      disabled={row.original.state !== 'running'}
                      onSelect={() => setPendingAction({ type: 'stop', container: row.original })}
                    >
                      <IconPlayerStopFilled className='mr-2 size-4' />
                      Stop
                    </ContextMenuItem>
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      onSelect={() => setPendingAction({ type: 'remove', container: row.original })}
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
        title={pendingAction?.type === 'stop' ? 'Stop container?' : 'Remove container?'}
        description={
          pendingAction?.type === 'stop'
            ? 'This stops the selected Docker container without deleting it.'
            : 'This permanently removes the selected Docker container.'
        }
        summary={pendingAction?.container.names[0] ?? pendingAction?.container.shortId}
        consequence={
          pendingAction?.type === 'remove' ? 'Persistent volumes are not removed by this action.' : undefined
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
            ? 'This stops every running container in the current selection.'
            : 'This permanently removes every eligible container in the current selection.'
        }
        consequence={pendingBulkAction === 'remove' ? 'Persistent volumes are not removed by this action.' : undefined}
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

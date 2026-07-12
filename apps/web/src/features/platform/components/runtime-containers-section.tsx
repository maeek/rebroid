'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/container-actions'
import { actionOk, unwrapActionResult } from '@/shared/actions/action-result'
import { DataGrid, DataGridPagination, DataGridWorkspace } from '@/shared/ui/data-grid'
import {
  buildContainersGridHref,
  canRunBulkContainerAction,
  selectVisibleOrphanedContainerIds,
  shouldStopContainerInBulkAction,
  summarizeContainerBulkActionResults,
  type ContainerBulkActionType
} from './runtime-containers-section-model'
import { createContainerColumns } from './runtime-containers-table-parts'
import { RuntimeContainerFilters } from './runtime-grid-filter-controls'
import {
  platformSortFromSearchParam,
  platformSortToSearchParam,
  retainVisiblePlatformSelection,
  selectedPlatformItemsFromIds
} from './runtime-grid-query-utils'
import type {
  PlatformContainer,
  PlatformContainersGridPage,
  PlatformContainersGridQuery
} from '@/server/orchestrator/platform/types'

type PendingAction = { type: 'stop' | 'remove'; container: PlatformContainer } | null

export const RuntimeContainersSection = ({
  containersPage,
  gridQuery
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [pendingBulkAction, setPendingBulkAction] = useState<ContainerBulkActionType | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(() => platformSortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisiblePlatformSelection(containersPage.items, current))
  }, [containersPage.items])

  const selectedContainers = selectedPlatformItemsFromIds(containersPage.items, selectedIds)

  const pushGridParams = (patch: Partial<PlatformContainersGridQuery>) =>
    router.replace(buildContainersGridHref({ gridQuery, pageSize: containersPage.pageSize, patch }), { scroll: false })

  const runContainerAction = async () => {
    if (!pendingAction) return

    setBusyId(pendingAction.container.id)
    try {
      if (pendingAction.type === 'stop') {
        unwrapActionResult(await stopPlatformContainerAction(pendingAction.container.id))
        toast({ title: 'Container stopped', variant: 'success' })
      } else {
        unwrapActionResult(await removePlatformContainerAction(pendingAction.container.id))
        toast({ title: 'Container removed', variant: 'success' })
      }
      setPendingAction(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: pendingAction.type === 'stop' ? 'Could not stop container' : 'Could not remove container',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  const runBulkAction = async (type: ContainerBulkActionType) => {
    if (selectedContainers.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.all(
        selectedContainers.map(async container => {
          if (type === 'stop' && shouldStopContainerInBulkAction(container)) {
            return stopPlatformContainerAction(container.id)
          }
          if (type === 'remove') {
            return removePlatformContainerAction(container.id)
          }
          return actionOk(undefined)
        })
      )
      setSelectedIds(new Set())
      setPendingBulkAction(null)
      router.refresh()
      toast(summarizeContainerBulkActionResults(results, type))
    } finally {
      setBusyId(null)
    }
  }

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
          onSearch={value => pushGridParams({ q: value.trim() || undefined, page: 1 })}
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
            onPageIndexChange={pageIndex => pushGridParams({ page: pageIndex + 1 })}
            onPageSizeChange={pageSize => pushGridParams({ page: 1, pageSize })}
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

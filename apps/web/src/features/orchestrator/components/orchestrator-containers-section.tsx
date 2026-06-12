'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContextMenuItem } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Section } from '@/components/ui/section'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import {
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/container-actions'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/shared/ui/data-grid'
import {
  buildContainersGridHref,
  canRunBulkContainerAction,
  selectVisibleOrphanedContainerIds,
  shouldStopContainerInBulkAction,
  summarizeContainerBulkActionResults,
  type ContainerBulkActionType
} from './orchestrator-containers-section-model'
import { createContainerColumns } from './orchestrator-containers-table-parts'
import {
  platformSortFromSearchParam,
  platformSortToSearchParam,
  retainVisiblePlatformSelection,
  selectedPlatformItemsFromIds
} from './orchestrator-grid-query-utils'
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
import type {
  PlatformContainer,
  PlatformContainersGridPage,
  PlatformContainersGridQuery
} from '@/server/orchestrator/platform/types'

type PendingAction = { type: 'stop' | 'remove'; container: PlatformContainer } | null

export const OrchestratorContainersSection = ({
  containersPage,
  gridQuery,
  refreshKey = 0,
  onRefreshComplete
}: {
  containersPage: PlatformContainersGridPage
  gridQuery: PlatformContainersGridQuery
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(() => platformSortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisiblePlatformSelection(containersPage.items, current))
  }, [containersPage.items])

  useEffect(() => {
    if (refreshKey > 0) {
      router.refresh()
      onRefreshComplete?.()
    }
  }, [onRefreshComplete, refreshKey, router])

  const selectedContainers = selectedPlatformItemsFromIds(containersPage.items, selectedIds)

  const pushGridParams = (patch: Partial<PlatformContainersGridQuery>) =>
    router.push(buildContainersGridHref({ gridQuery, pageSize: containersPage.pageSize, patch }))

  const runContainerAction = async () => {
    if (!pendingAction) return

    setBusyId(pendingAction.container.id)
    try {
      if (pendingAction.type === 'stop') {
        await stopPlatformContainerAction(pendingAction.container.id)
        toast({ title: 'Container stopped' })
      } else {
        await removePlatformContainerAction(pendingAction.container.id)
        toast({ title: 'Container removed' })
      }
      setPendingAction(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: pendingAction.type === 'stop' ? 'Could not stop container' : 'Could not remove container',
        description: caughtError instanceof Error ? caughtError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const runBulkAction = async (type: ContainerBulkActionType) => {
    if (selectedContainers.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.allSettled(
        selectedContainers.map(async container => {
          if (type === 'stop' && shouldStopContainerInBulkAction(container)) {
            await stopPlatformContainerAction(container.id)
          }
          if (type === 'remove') {
            await removePlatformContainerAction(container.id)
          }
        })
      )
      setSelectedIds(new Set())
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

  return (
    <>
      <Section contentClassName='gap-4'>
        <Visible when={containersPage.orphanedCount > 0}>
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm'>
            <span className='text-destructive'>
              {containersPage.orphanedCount} managed Rebroid container
              {containersPage.orphanedCount === 1 ? '' : 's'} no longer have an app record.
            </span>
            <Button
              type='button'
              variant='destructive'
              disabled={busyId === 'bulk'}
              onClick={selectVisibleOrphaned}
            >
              Select visible orphaned
            </Button>
          </div>
        </Visible>

        <DataGridToolbar
          search={search}
          searchPlaceholder='Search containers'
          onSearchChange={setSearch}
          onSearchSubmit={() => pushGridParams({ q: search.trim() || undefined, page: 1 })}
          activeFilterCount={gridQuery.scope === 'all' ? 1 : 0}
          selectedCount={selectedContainers.length}
          filters={
            <PlatformResourceScopeFilter
              value={gridQuery.scope ?? 'managed'}
              onValueChange={scope => pushGridParams({ scope, page: 1 })}
            />
          }
          actions={
            <>
              <Button
                type='button'
                variant='ghost'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => void runBulkAction('stop')}
              >
                Stop selected
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={busyId === 'bulk' || !canRunBulkContainerAction(selectedContainers)}
                onClick={() => void runBulkAction('remove')}
              >
                Remove selected
              </Button>
            </>
          }
        />

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
            minWidth='90rem'
            emptyState={
              <div className='text-center text-secondary-foreground'>
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
                        onSelect={() => void runBulkAction('stop')}
                      >
                        <IconPlayerStopFilled className='mr-2 size-4' />
                        Stop selected ({selectedContainers.length})
                      </ContextMenuItem>
                      <ContextMenuItem
                        className='text-destructive focus:text-destructive'
                        disabled={busyId === 'bulk'}
                        onSelect={() => void runBulkAction('remove')}
                      >
                        <IconTrash className='mr-2 size-4' />
                        Remove selected ({selectedContainers.length})
                      </ContextMenuItem>
                    </>
                  ) : null}
                  <ContextMenuItem asChild>
                    <Link href={`/infrastructure/containers/${row.original.id}`}>
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
                    className='text-destructive focus:text-destructive'
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
      </Section>

      <Dialog
        modal
        open={Boolean(pendingAction)}
        onOpenChange={open => {
          if (!open) setPendingAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.type === 'stop' ? 'Stop container?' : 'Remove container?'}</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === 'stop'
                ? 'This stops the selected Docker container without deleting it.'
                : 'This force-removes the selected Docker container. Persistent volumes are not removed by this action.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={pendingAction?.type === 'stop' ? 'secondary' : 'destructive'}
              disabled={!pendingAction || busyId === pendingAction.container.id}
              onClick={() => void runContainerAction()}
            >
              {pendingAction?.type === 'stop' ? 'Stop container' : 'Remove container'}
            </Button>
            <DialogClose asChild>
              <Button variant='secondary'>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

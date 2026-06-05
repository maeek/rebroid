'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconPlayerStopFilled, IconTerminal2, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { removePlatformContainerAction, stopPlatformContainerAction } from '@/server/orchestrator/platform/actions'
import { ContainerNameCell, ContainerStateBadge } from './orchestrator-containers-table-parts'
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
import type {
  PlatformContainer,
  PlatformContainersGridPage,
  PlatformContainersGridQuery
} from '@/server/orchestrator/platform/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

type PendingAction = { type: 'stop' | 'remove'; container: PlatformContainer } | null

const compactParams = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? '').trim()
    if (text && !(key === 'scope' && text === 'managed')) params.set(key, text)
  }
  return params
}

const sortToSearchParam = (sorting: SortingState) =>
  sorting.length === 0 ? undefined : sorting.map(item => `${item.id}:${item.desc ? 'desc' : 'asc'}`).join(',')

const sortFromSearchParam = (sort: string | undefined): SortingState =>
  (sort ?? 'name:asc')
    .split(',')
    .map(part => {
      const [id, direction] = part.split(':')
      if (!id) return null
      return { id, desc: direction === 'desc' }
    })
    .filter((item): item is SortingState[number] => Boolean(item))
    .slice(0, 3)

const containerName = (container: PlatformContainer) => container.names[0] ?? container.shortId

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
  const sorting = useMemo(() => sortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    const currentPageIds = new Set(containersPage.items.map(container => container.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => currentPageIds.has(id))))
  }, [containersPage.items])

  useEffect(() => {
    if (refreshKey > 0) {
      router.refresh()
      onRefreshComplete?.()
    }
  }, [onRefreshComplete, refreshKey, router])

  const selectedContainers = containersPage.items.filter(container => selectedIds.has(container.id))

  const pushGridParams = (patch: Partial<PlatformContainersGridQuery>) => {
    const params = compactParams({
      q: patch.q ?? gridQuery.q,
      scope: patch.scope ?? gridQuery.scope ?? 'managed',
      sort: patch.sort ?? gridQuery.sort,
      page: patch.page ?? gridQuery.page ?? 1,
      pageSize: patch.pageSize ?? gridQuery.pageSize ?? containersPage.pageSize
    })
    router.push(`/settings/orchestrator/containers${params.size ? `?${params.toString()}` : ''}`)
  }

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

  const runBulkAction = async (type: 'stop' | 'remove') => {
    if (selectedContainers.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.allSettled(
        selectedContainers.map(async container => {
          if (type === 'stop' && container.state === 'running') {
            await stopPlatformContainerAction(container.id)
          }
          if (type === 'remove') {
            await removePlatformContainerAction(container.id)
          }
        })
      )
      const failedCount = results.filter(result => result.status === 'rejected').length
      setSelectedIds(new Set())
      router.refresh()
      toast(
        failedCount > 0
          ? {
              title: type === 'stop' ? 'Some containers could not be stopped' : 'Some containers could not be removed',
              description: `${failedCount} request${failedCount === 1 ? '' : 's'} failed.`,
              variant: 'destructive'
            }
          : { title: type === 'stop' ? 'Selected containers stopped' : 'Selected containers removed' }
      )
    } finally {
      setBusyId(null)
    }
  }

  const selectVisibleOrphaned = () => {
    const next = new Set(selectedIds)
    for (const container of containersPage.items) {
      if (container.orphaned) next.add(container.id)
    }
    setSelectedIds(next)
  }

  const columns = useMemo<ColumnDef<PlatformContainer>[]>(
    () => [
      {
        id: 'name',
        accessorFn: container => containerName(container),
        header: 'Container',
        size: 288,
        meta: { label: 'Container' },
        cell: ({ row }) => <ContainerNameCell container={row.original} />
      },
      {
        id: 'state',
        accessorFn: container => container.state,
        header: 'State',
        size: 128,
        meta: { label: 'State' },
        cell: ({ row }) => <ContainerStateBadge state={row.original.state} />
      },
      {
        id: 'image',
        accessorFn: container => container.image,
        header: 'Image',
        size: 384,
        meta: { label: 'Image' },
        cell: ({ row }) => <div className='truncate text-sm text-secondary-foreground'>{row.original.image}</div>
      },
      {
        id: 'applicationId',
        accessorFn: container => container.applicationId ?? '',
        header: 'Application',
        size: 256,
        meta: { label: 'Application' },
        cell: ({ row }) => (
          <div className='truncate text-sm text-secondary-foreground'>{row.original.applicationId ?? 'unmanaged'}</div>
        )
      },
      {
        id: 'networks',
        header: 'Networks',
        size: 288,
        enableSorting: false,
        meta: { label: 'Networks' },
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-1 text-sm text-secondary-foreground'>
            {row.original.networks.length > 0
              ? row.original.networks.map(network => (
                  <Link
                    key={network}
                    href={`/settings/orchestrator/networks/${encodeURIComponent(network)}`}
                    className='max-w-full truncate rounded-full bg-background/60 px-2 py-0.5 hover:text-primary'
                  >
                    {network}
                  </Link>
                ))
              : 'none'}
          </div>
        )
      }
    ],
    []
  )

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
                disabled={busyId === 'bulk' || selectedContainers.length === 0}
                onClick={() => void runBulkAction('stop')}
              >
                Stop selected
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={busyId === 'bulk' || selectedContainers.length === 0}
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
              pushGridParams({ sort: sortToSearchParam(nextSorting), page: 1 })
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
            mobileCard={row => {
              const container = row.original
              const selected = selectedIds.has(container.id)
              return (
                <div
                  key={container.id}
                  className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4'
                >
                  <div className='flex items-start gap-3'>
                    <Checkbox
                      checked={selected}
                      aria-label='Select container'
                      onCheckedChange={checked => {
                        const next = new Set(selectedIds)
                        if (checked === true) next.add(container.id)
                        else next.delete(container.id)
                        setSelectedIds(next)
                      }}
                    />
                    <ContainerNameCell
                      container={container}
                      className='min-w-0 flex-1'
                    />
                  </div>
                  <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                    <div>
                      <dt className='text-secondary-foreground'>State</dt>
                      <dd>
                        <ContainerStateBadge state={container.state} />
                      </dd>
                    </div>
                    <div>
                      <dt className='text-secondary-foreground'>Application</dt>
                      <dd className='truncate'>{container.applicationId ?? 'unmanaged'}</dd>
                    </div>
                    <div className='col-span-2'>
                      <dt className='text-secondary-foreground'>Image</dt>
                      <dd className='truncate'>{container.image}</dd>
                    </div>
                    <div className='col-span-2'>
                      <dt className='text-secondary-foreground'>Networks</dt>
                      <dd className='truncate'>
                        {container.networks.length > 0 ? container.networks.join(', ') : 'none'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            }}
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
                    <Link href={`/settings/orchestrator/containers/${row.original.id}`}>
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

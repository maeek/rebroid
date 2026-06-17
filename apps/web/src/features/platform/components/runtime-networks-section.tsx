'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconTrash } from '@tabler/icons-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/shared/ui/data-grid'
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
import { PlatformResourceScopeFilter } from './platform-resource-scope-filter'
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
        <span className='shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground'>
          internal
        </span>
      </Visible>
    </div>
    <div className='truncate text-xs text-muted-foreground'>{network.shortId}</div>
  </div>
)

export const RuntimeNetworksSection = ({
  networksPage,
  gridQuery,
  refreshKey = 0,
  onRefreshComplete
}: {
  networksPage: PlatformNetworksGridPage
  gridQuery: PlatformNetworksGridQuery
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const router = useRouter()
  const [search, setSearch] = useState(gridQuery.q ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingRemove, setPendingRemove] = useState<PlatformNetwork | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const sorting = useMemo(() => platformSortFromSearchParam(gridQuery.sort), [gridQuery.sort])

  useEffect(() => {
    setSearch(gridQuery.q ?? '')
  }, [gridQuery.q])

  useEffect(() => {
    setSelectedIds(current => retainVisiblePlatformSelection(networksPage.items, current))
  }, [networksPage.items])

  useEffect(() => {
    if (refreshKey > 0) {
      router.refresh()
      onRefreshComplete?.()
    }
  }, [onRefreshComplete, refreshKey, router])

  const selectedNetworks = selectedPlatformItemsFromIds(networksPage.items, selectedIds)

  const pushGridParams = (patch: Partial<PlatformNetworksGridQuery>) => {
    router.push(buildNetworksGridHref({ gridQuery, pageSize: networksPage.pageSize, patch }))
  }

  const removeNetwork = async () => {
    if (!pendingRemove) return

    setBusyId(pendingRemove.id)
    try {
      await removePlatformNetworkAction(pendingRemove.id)
      toast({ title: 'Network removed' })
      setPendingRemove(null)
      router.refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove network',
        description: caughtError instanceof Error ? caughtError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const removeSelectedNetworks = async () => {
    if (selectedNetworks.length === 0) return

    setBusyId('bulk')
    try {
      const results = await Promise.allSettled(selectedNetworks.map(network => removePlatformNetworkAction(network.id)))
      setSelectedIds(new Set())
      router.refresh()
      toast(summarizeNetworkRemoveResults(results))
    } finally {
      setBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<PlatformNetwork>[]>(
    () => [
      {
        id: 'name',
        accessorFn: network => network.name,
        header: 'Network',
        size: 352,
        meta: { label: 'Network' },
        cell: ({ row }) => <NetworkNameCell network={row.original} />
      },
      {
        id: 'driver',
        accessorFn: network => network.driver,
        header: 'Driver',
        size: 128,
        meta: { label: 'Driver' },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.driver}</span>
      },
      {
        id: 'scope',
        accessorFn: network => network.scope,
        header: 'Scope',
        size: 112,
        meta: { label: 'Scope' },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.scope}</span>
      },
      {
        id: 'subnets',
        header: 'Subnet',
        size: 320,
        enableSorting: false,
        meta: { label: 'Subnet' },
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
        meta: { label: 'Gateway' },
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
        meta: { label: 'Containers' },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{row.original.containers.length}</span>
      }
    ],
    []
  )

  return (
    <>
      <Section contentClassName='gap-4'>
        <DataGridToolbar
          search={search}
          searchPlaceholder='Search networks'
          onSearchChange={setSearch}
          onSearchSubmit={() => pushGridParams({ q: search.trim() || undefined, page: 1 })}
          activeFilterCount={gridQuery.scope === 'all' ? 1 : 0}
          selectedCount={selectedNetworks.length}
          filters={
            <PlatformResourceScopeFilter
              value={gridQuery.scope ?? 'managed'}
              onValueChange={scope => pushGridParams({ scope, page: 1 })}
            />
          }
          actions={
            <Button
              type='button'
              variant='ghost'
              disabled={busyId === 'bulk' || !canRemoveSelectedNetworks(selectedNetworks)}
              onClick={() => void removeSelectedNetworks()}
            >
              Remove selected
            </Button>
          }
        />

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
            minWidth='82rem'
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
                      className='text-destructive focus:text-destructive'
                      disabled={busyId === 'bulk' || !canRemoveSelectedNetworks(selectedNetworks)}
                      onSelect={() => void removeSelectedNetworks()}
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
                    className='text-destructive focus:text-destructive'
                    disabled={networkHasAttachedContainers(row.original)}
                    onSelect={() => setPendingRemove(row.original)}
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
      </Section>

      <Dialog
        modal
        open={Boolean(pendingRemove)}
        onOpenChange={open => {
          if (!open) setPendingRemove(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove network?</DialogTitle>
            <DialogDescription>
              This removes {pendingRemove?.name ?? 'the selected network'} from Docker. Networks with attached
              containers cannot be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='destructive'
              disabled={!pendingRemove || busyId === pendingRemove.id}
              onClick={() => void removeNetwork()}
            >
              Remove network
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

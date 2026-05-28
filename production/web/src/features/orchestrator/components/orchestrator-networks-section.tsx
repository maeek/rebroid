'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconEye, IconLoader2, IconRefresh, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { listPlatformNetworksAction, removePlatformNetworkAction } from '@/server/orchestrator/platform/actions'
import { PlatformGridPagination } from './platform-grid-pagination'
import { PlatformSelectionToolbar } from './platform-selection-toolbar'
import { useGridSelection } from './use-grid-selection'
import type { PlatformNetwork } from '@/server/orchestrator/platform/types'

const NetworkNameCell = ({ network }: { network: PlatformNetwork }) => (
  <div className='flex min-w-[16rem] flex-col gap-1'>
    <div className='flex min-w-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/settings/orchestrator/networks/${network.id}`}
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

export const OrchestratorNetworksSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [networks, setNetworks] = useState<PlatformNetwork[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pendingRemove, setPendingRemove] = useState<PlatformNetwork | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const sortedNetworks = useMemo(
    () =>
      [...networks].sort((a, b) => {
        if (a.managed !== b.managed) {
          return a.managed ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      }),
    [networks]
  )

  const filteredNetworks = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return sortedNetworks
    }

    return sortedNetworks.filter(network =>
      [
        network.id,
        network.shortId,
        network.name,
        network.driver,
        network.scope,
        ...network.subnets,
        ...network.gateways,
        ...network.containers
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [search, sortedNetworks])

  const selection = useGridSelection(filteredNetworks)

  const paginatedNetworks = useMemo(
    () => filteredNetworks.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredNetworks, pageIndex, pageSize]
  )

  const refresh = async () => {
    setIsLoading(true)
    try {
      setNetworks(await listPlatformNetworksAction())
      setError(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load network inventory.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [refreshKey])

  useEffect(() => {
    setPageIndex(0)
  }, [search])

  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredNetworks.length / pageSize), 1)
    if (pageIndex >= pageCount) {
      setPageIndex(pageCount - 1)
    }
  }, [filteredNetworks.length, pageIndex, pageSize])

  const removeNetwork = async () => {
    if (!pendingRemove) {
      return
    }

    setBusyId(pendingRemove.id)
    try {
      await removePlatformNetworkAction(pendingRemove.id)
      toast({ title: 'Network removed' })
      setPendingRemove(null)
      await refresh()
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
    const targets = selection.selectedItems
    if (targets.length === 0) {
      return
    }

    setBusyId('bulk')
    try {
      for (const network of targets) {
        await removePlatformNetworkAction(network.id)
      }
      selection.clearSelection()
      toast({ title: 'Selected networks removed' })
      await refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove selected networks',
        description: caughtError instanceof Error ? caughtError.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setBusyId(null)
    }
  }

  const emptyMessage = search.trim() ? 'No networks match this search.' : 'No networks are visible to Docker.'

  return (
    <>
      <Section
        title='Networks'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-4'
      >
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-secondary-foreground'>
            Docker networks visible to the platform, including per-application isolation networks.
          </p>
        </div>
        <PlatformSelectionToolbar
          search={search}
          placeholder='Search networks'
          selectedCount={selection.selectedItems.length}
          onSearchChange={setSearch}
          actions={
            <>
              <Button
                type='button'
                variant='ghost'
                disabled={isLoading}
                onClick={() => void refresh()}
              >
                {isLoading ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
                Refresh
              </Button>
              <Button
                type='button'
                variant='ghost'
                disabled={
                  busyId === 'bulk' ||
                  selection.selectedItems.some(network => network.containers.length > 0) ||
                  selection.selectedItems.length === 0
                }
                onClick={() => void removeSelectedNetworks()}
              >
                Remove selected
              </Button>
            </>
          }
        />
        <Visible when={error}>
          <div className='rounded-md border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
            {error}
          </div>
        </Visible>
        <Visible when={!error}>
          <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
            <div className='overflow-x-auto'>
              <TooltipProvider delayDuration={150}>
                <Table
                  className='table-fixed'
                  style={{ minWidth: '78rem' }}
                >
                  <TableHeader className='bg-background/45'>
                    <TableRow className='hover:bg-transparent'>
                      <TableHead className='w-12 px-4 py-3'>
                        <Checkbox
                          checked={
                            paginatedNetworks.length > 0 &&
                            paginatedNetworks.every(network => selection.selectedIds.has(network.id))
                          }
                          onCheckedChange={checked => selection.selectPage(paginatedNetworks, checked === true)}
                        />
                      </TableHead>
                      <TableHead className='w-88 px-4 py-3 uppercase'>Network</TableHead>
                      <TableHead className='w-32 px-4 py-3 uppercase'>Driver</TableHead>
                      <TableHead className='w-28 px-4 py-3 uppercase'>Scope</TableHead>
                      <TableHead className='w-[20rem] px-4 py-3 uppercase'>Subnet</TableHead>
                      <TableHead className='w-48 px-4 py-3 uppercase'>Gateway</TableHead>
                      <TableHead className='w-32 px-4 py-3 uppercase'>Containers</TableHead>
                      <TableHead className='w-40 px-4 py-3 text-right uppercase'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Visible when={isLoading && networks.length === 0}>
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          Loading networks...
                        </TableCell>
                      </TableRow>
                    </Visible>
                    <Visible when={!isLoading && filteredNetworks.length === 0}>
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className='px-4 py-4 text-sm text-secondary-foreground'
                        >
                          {emptyMessage}
                        </TableCell>
                      </TableRow>
                    </Visible>
                    <Visible when={filteredNetworks.length > 0}>
                      {paginatedNetworks.map((network, index) => (
                        <TableRow key={network.id}>
                          <TableCell className='px-4 py-3'>
                            <Checkbox
                              checked={selection.selectedIds.has(network.id)}
                              onClick={event =>
                                selection.toggleSelection(network, pageIndex * pageSize + index, event.shiftKey)
                              }
                              onCheckedChange={() => undefined}
                            />
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <NetworkNameCell network={network} />
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {network.driver}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {network.scope}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <div className='truncate text-sm text-secondary-foreground'>
                              {network.subnets.length > 0 ? network.subnets.join(', ') : 'none'}
                            </div>
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <div className='truncate text-sm text-secondary-foreground'>
                              {network.gateways.length > 0 ? network.gateways.join(', ') : 'none'}
                            </div>
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top text-sm text-secondary-foreground'>
                            {network.containers.length}
                          </TableCell>
                          <TableCell className='px-4 py-3 align-top'>
                            <div className='flex justify-end gap-2'>
                              <Button
                                asChild
                                variant='secondary'
                              >
                                <Link href={`/settings/orchestrator/networks/${network.id}`}>
                                  <IconEye className='size-4' />
                                </Link>
                              </Button>
                              <Button
                                type='button'
                                variant='destructive'
                                disabled={busyId === network.id || busyId === 'bulk' || network.containers.length > 0}
                                onClick={() => setPendingRemove(network)}
                              >
                                <IconTrash className='size-4' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Visible>
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
        </Visible>
        <Visible when={!error}>
          <PlatformGridPagination
            totalItems={filteredNetworks.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        </Visible>
      </Section>

      <Dialog
        modal
        open={Boolean(pendingRemove)}
        onOpenChange={open => {
          if (!open) {
            setPendingRemove(null)
          }
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

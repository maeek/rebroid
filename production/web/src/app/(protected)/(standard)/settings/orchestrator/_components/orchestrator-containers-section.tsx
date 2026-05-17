'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconRefresh, IconSearch } from '@tabler/icons-react'
import { OrchestratorContainersTable } from '@/app/(protected)/(standard)/settings/orchestrator/_components/orchestrator-containers-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Section } from '@/components/ui/section'
import { toast } from '@/hooks/use-toast'
import {
  listPlatformContainersAction,
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/lib/orchestrator/actions'
import { PlatformGridPagination } from './platform-grid-pagination'
import type { PlatformContainer } from '@/lib/orchestrator/types'

type PendingAction = { type: 'stop' | 'remove'; container: PlatformContainer } | null

export const OrchestratorContainersSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [containers, setContainers] = useState<PlatformContainer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const sortedContainers = useMemo(
    () =>
      [...containers].sort((a, b) => {
        if (a.managed !== b.managed) {
          return a.managed ? -1 : 1
        }
        if (a.state !== b.state) {
          return a.state === 'running' ? -1 : 1
        }
        return (a.names[0] ?? a.shortId).localeCompare(b.names[0] ?? b.shortId)
      }),
    [containers]
  )

  const filteredContainers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return sortedContainers
    }

    return sortedContainers.filter(container =>
      [
        container.id,
        container.shortId,
        ...container.names,
        container.image,
        container.imageId,
        container.command,
        container.state,
        container.status,
        container.applicationId ?? '',
        container.component ?? '',
        ...container.networks
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [search, sortedContainers])

  const paginatedContainers = useMemo(
    () => filteredContainers.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredContainers, pageIndex, pageSize]
  )

  const refresh = async () => {
    setIsLoading(true)
    try {
      setContainers(await listPlatformContainersAction())
      setError(null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load container inventory.')
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
    const pageCount = Math.max(Math.ceil(filteredContainers.length / pageSize), 1)
    if (pageIndex >= pageCount) {
      setPageIndex(pageCount - 1)
    }
  }, [filteredContainers.length, pageIndex, pageSize])

  const runContainerAction = async () => {
    if (!pendingAction) {
      return
    }

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
      await refresh()
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

  return (
    <>
      <Section
        title='Containers'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-4'
      >
        <div className='flex items-center justify-between gap-3'>
          <p className='text-sm text-secondary-foreground'>
            Docker containers visible to the platform. Managed application containers are shown first.
          </p>
          <Button
            type='button'
            variant='secondary'
            disabled={isLoading}
            onClick={() => void refresh()}
          >
            <IconRefresh className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        </div>
        <div className='relative max-w-md'>
          <IconSearch className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            placeholder='Search containers'
            className='pl-9'
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        {error ? (
          <div className='rounded-md border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
            {error}
          </div>
        ) : (
          <OrchestratorContainersTable
            containers={paginatedContainers}
            isLoading={isLoading}
            busyId={busyId}
            emptyMessage={search.trim() ? 'No containers match this search.' : undefined}
            onStop={container => setPendingAction({ type: 'stop', container })}
            onRemove={container => setPendingAction({ type: 'remove', container })}
          />
        )}
        {!error && (
          <PlatformGridPagination
            totalItems={filteredContainers.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={setPageSize}
          />
        )}
      </Section>

      <Dialog
        modal
        open={Boolean(pendingAction)}
        onOpenChange={open => {
          if (!open) {
            setPendingAction(null)
          }
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRestore, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Section } from '@/components/ui/section'
import { PlatformDetailRow } from '@/features/orchestrator/components/platform-detail-parts'
import { PlatformStatusBanner } from '@/features/orchestrator/components/platform-status-banner'
import { toast } from '@/hooks/use-toast'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction,
  repairDisplaySidecarAction,
  releaseDisplaySidecarSessionAction
} from '@/server/orchestrator/diagnostics/actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { DisplaySidecarSession, ServiceHealth } from '@/server/orchestrator/diagnostics/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

const formatTimestamp = (value: string) => new Date(value).toLocaleString()
const castingMessage = (message: string) => message.replace(/display sidecar/gi, 'casting sidecar')
const castingErrorMessage = (error: unknown) => castingMessage(error instanceof Error ? error.message : 'Unknown error')
const formatHealthDetail = (value: unknown) => {
  if (value === null) return 'none'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
const activeStatuses = new Set(['created', 'active'])
const castingDetailLabels: Record<string, string> = {
  autoStart: 'Auto start',
  containerId: 'Container ID',
  containerName: 'Container name',
  error: 'Error',
  exitCode: 'Exit code',
  finishedAt: 'Finished at',
  image: 'Image',
  port: 'Port',
  publishedHostPort: 'Published host port',
  recentLogs: 'Recent logs',
  restartCount: 'Restart count'
}

const sortSessions = (sessions: DisplaySidecarSession[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'lastActivityAt', desc: true }]
  return [...sessions].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'application') result = (left.applicationId ?? '').localeCompare(right.applicationId ?? '')
      else if (item.id === 'id') result = left.id.localeCompare(right.id)
      else if (item.id === 'status') result = left.status.localeCompare(right.status)
      else if (item.id === 'lastActivityAt') {
        result = new Date(left.lastActivityAt).getTime() - new Date(right.lastActivityAt).getTime()
      } else if (item.id === 'expiresAt') {
        result = new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime()
      }
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export const CastingSidecarSettings = ({
  initialHealth,
  initialSessions,
  applications,
  owners,
  refreshKey = 0,
  onRefreshComplete
}: {
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const [health, setHealth] = useState(initialHealth)
  const [sessions, setSessions] = useState(initialSessions)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastActivityAt', desc: true }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const appsById = useMemo(() => new Map(applications.map(app => [app.id, app])), [applications])
  const ownerNames = useMemo(() => new Map(owners.map(owner => [owner.id, owner.name])), [owners])

  const filteredSessions = useMemo(() => {
    const query = submittedSearch.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter(session => {
      const app = session.applicationId ? appsById.get(session.applicationId) : undefined
      return [session.id, session.applicationId, app?.name, session.ownerUserId, session.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [appsById, sessions, submittedSearch])
  const sortedSessions = useMemo(() => sortSessions(filteredSessions, sorting), [filteredSessions, sorting])
  const paginatedSessions = useMemo(
    () => sortedSessions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [pageIndex, pageSize, sortedSessions]
  )
  const selectedSessions = sortedSessions.filter(session => selectedIds.has(session.id))

  useEffect(() => setPageIndex(0), [submittedSearch])
  useEffect(() => {
    const pageCount = Math.max(Math.ceil(sortedSessions.length / pageSize), 1)
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1)
  }, [pageIndex, pageSize, sortedSessions.length])
  useEffect(() => {
    const visibleIds = new Set(sortedSessions.map(session => session.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => visibleIds.has(id))))
  }, [sortedSessions])

  const refresh = useCallback(async () => {
    setBusy('refresh')
    try {
      const nextHealth = await getOrchestratorHealthAction()
      setHealth(nextHealth.services.display)
      setSessions(nextHealth.services.display.ok ? await listDisplaySidecarSessionsAction() : [])
    } catch (error) {
      toast({
        title: 'Could not load casting sessions',
        description: castingErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
      onRefreshComplete?.()
    }
  }, [onRefreshComplete])

  useEffect(() => {
    if (refreshKey > 0) {
      void refresh()
    }
  }, [refresh, refreshKey])

  const restartSidecar = async () => {
    setBusy('restart')
    try {
      await repairDisplaySidecarAction()
      toast({ title: 'Casting sidecar restarted' })
      await refresh()
    } catch (error) {
      toast({
        title: 'Could not restart casting sidecar',
        description: castingErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const killSessions = async (targets: DisplaySidecarSession[]) => {
    if (targets.length === 0) return
    setBusy(targets.length === 1 ? targets[0].id : 'bulk')
    try {
      const killed = await Promise.all(
        targets
          .filter(session => activeStatuses.has(session.status))
          .map(session => releaseDisplaySidecarSessionAction(session.id))
      )
      const killedById = new Map(killed.map(session => [session.id, session]))
      setSessions(current => current.map(session => killedById.get(session.id) ?? session))
      setSelectedIds(new Set())
      toast({ title: targets.length === 1 ? 'Casting session killed' : 'Selected casting sessions killed' })
    } catch (error) {
      toast({
        title: 'Could not kill casting session',
        description: castingErrorMessage(error),
        variant: 'destructive'
      })
    } finally {
      setBusy(null)
    }
  }

  const healthDetails = health.details ? (
    <div className='grid gap-x-8 xl:grid-cols-2'>
      {Object.entries(health.details).map(([key, value]) => (
        <PlatformDetailRow
          key={key}
          label={castingDetailLabels[key] ?? key}
          value={formatHealthDetail(value)}
        />
      ))}
    </div>
  ) : undefined

  const columns = useMemo<ColumnDef<DisplaySidecarSession>[]>(
    () => [
      {
        id: 'application',
        accessorFn: session => session.applicationId ?? '',
        header: 'Application and user',
        size: 352,
        meta: { label: 'Application and user' },
        cell: ({ row }) => {
          const app = row.original.applicationId ? appsById.get(row.original.applicationId) : undefined
          const ownerId = row.original.ownerUserId ?? app?.ownerUserId
          return (
            <div className='flex min-w-0 flex-col gap-1'>
              {row.original.applicationId ? (
                <Link
                  className='truncate font-medium hover:text-primary'
                  href={`/app/${row.original.applicationId}/manage`}
                >
                  {app?.name ?? row.original.applicationId}
                </Link>
              ) : (
                <span>Unassigned application</span>
              )}
              {ownerId ? (
                <Link
                  className='truncate text-xs text-muted-foreground hover:text-primary'
                  href={`/settings/users/${ownerId}`}
                >
                  {ownerNames.get(ownerId) ?? ownerId}
                </Link>
              ) : (
                <span className='text-xs text-muted-foreground'>Unknown user</span>
              )}
            </div>
          )
        }
      },
      {
        id: 'id',
        accessorFn: session => session.id,
        header: 'Session ID',
        size: 224,
        meta: { label: 'Session ID' },
        cell: ({ row }) => <span className='truncate text-sm text-secondary-foreground'>{row.original.id}</span>
      },
      {
        id: 'status',
        accessorFn: session => session.status,
        header: 'Status',
        size: 112,
        meta: { label: 'Status' },
        cell: ({ row }) => (
          <Badge
            className='capitalize'
            variant={row.original.status === 'active' ? 'status' : 'secondary'}
          >
            {row.original.status}
          </Badge>
        )
      },
      {
        id: 'lastActivityAt',
        accessorFn: session => session.lastActivityAt,
        header: 'Last activity',
        size: 192,
        meta: { label: 'Last activity' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{formatTimestamp(row.original.lastActivityAt)}</span>
        )
      },
      {
        id: 'expiresAt',
        accessorFn: session => session.expiresAt,
        header: 'Expires',
        size: 192,
        meta: { label: 'Expires' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{formatTimestamp(row.original.expiresAt)}</span>
        )
      }
    ],
    [appsById, ownerNames]
  )

  return (
    <>
      <PlatformStatusBanner
        status={health.status}
        ok={health.ok}
        message={castingMessage(health.message)}
        actions={
          <Button
            type='button'
            variant='outline'
            disabled={busy !== null}
            onClick={() => void restartSidecar()}
          >
            {busy === 'restart' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRestore className='size-4' />}
            Restart sidecar
          </Button>
        }
        details={healthDetails}
      />
      <Section
        title='Sessions'
        titleClassName='pb-2'
        contentClassName='gap-4'
      >
        <DataGridToolbar
          search={search}
          searchPlaceholder='Search sessions'
          onSearchChange={setSearch}
          onSearchSubmit={() => setSubmittedSearch(search.trim())}
          selectedCount={selectedSessions.length}
          actions={
            <Button
              type='button'
              variant='ghost'
              disabled={busy !== null || selectedSessions.length === 0}
              onClick={() => void killSessions(selectedSessions)}
            >
              Kill {selectedSessions.length || ''} session{selectedSessions.length === 1 ? '' : 's'}
            </Button>
          }
        />
        <DataGrid
          columns={columns}
          data={paginatedSessions}
          totalItems={sortedSessions.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          getRowId={session => session.id}
          sorting={sorting}
          onSortingChange={updater => {
            setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
            setPageIndex(0)
          }}
          selection={{
            selectedIds,
            onSelectedIdsChange: setSelectedIds
          }}
          minWidth='76rem'
          emptyState={
            <div className='text-center text-secondary-foreground'>
              {submittedSearch ? 'No sessions match this search.' : 'No casting sessions are known to the sidecar.'}
            </div>
          }
          mobileCard={row => {
            const session = row.original
            const app = session.applicationId ? appsById.get(session.applicationId) : undefined
            const ownerId = session.ownerUserId ?? app?.ownerUserId
            const selected = selectedIds.has(session.id)
            return (
              <div
                key={session.id}
                className='grid gap-3 rounded-lg border border-border/70 bg-background/25 p-4'
              >
                <div className='flex items-start gap-3'>
                  <Checkbox
                    checked={selected}
                    aria-label='Select session'
                    onCheckedChange={checked => {
                      const next = new Set(selectedIds)
                      if (checked === true) next.add(session.id)
                      else next.delete(session.id)
                      setSelectedIds(next)
                    }}
                  />
                  <div className='min-w-0 flex-1'>
                    {session.applicationId ? (
                      <Link
                        className='truncate font-medium hover:text-primary'
                        href={`/app/${session.applicationId}/manage`}
                      >
                        {app?.name ?? session.applicationId}
                      </Link>
                    ) : (
                      <span>Unassigned application</span>
                    )}
                    {ownerId ? (
                      <Link
                        className='block truncate text-xs text-muted-foreground hover:text-primary'
                        href={`/settings/users/${ownerId}`}
                      >
                        {ownerNames.get(ownerId) ?? ownerId}
                      </Link>
                    ) : (
                      <span className='text-xs text-muted-foreground'>Unknown user</span>
                    )}
                  </div>
                </div>
                <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                  <div>
                    <dt className='text-secondary-foreground'>Status</dt>
                    <dd>
                      <Badge
                        className='capitalize'
                        variant={session.status === 'active' ? 'status' : 'secondary'}
                      >
                        {session.status}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className='text-secondary-foreground'>Session ID</dt>
                    <dd className='truncate'>{session.id}</dd>
                  </div>
                  <div>
                    <dt className='text-secondary-foreground'>Last activity</dt>
                    <dd>{formatTimestamp(session.lastActivityAt)}</dd>
                  </div>
                  <div>
                    <dt className='text-secondary-foreground'>Expires</dt>
                    <dd>{formatTimestamp(session.expiresAt)}</dd>
                  </div>
                </dl>
              </div>
            )
          }}
          rowContextMenu={row => {
            const hasBulkSelection = selectedIds.has(row.original.id) && selectedSessions.length > 1
            return (
              <>
                {hasBulkSelection ? (
                  <ContextMenuItem
                    disabled={busy !== null}
                    onSelect={() => void killSessions(selectedSessions)}
                  >
                    <IconTrash className='mr-2 size-4' />
                    Kill selected ({selectedSessions.length})
                  </ContextMenuItem>
                ) : null}
                <ContextMenuItem
                  disabled={busy !== null || !activeStatuses.has(row.original.status)}
                  onSelect={() => void killSessions([row.original])}
                >
                  <IconTrash className='mr-2 size-4' />
                  Kill session
                </ContextMenuItem>
              </>
            )
          }}
        />
        <DataGridPagination
          totalItems={sortedSessions.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
        />
      </Section>
    </>
  )
}

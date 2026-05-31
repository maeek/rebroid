'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRefresh, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Section } from '@/components/ui/section'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import { PlatformDetailRow } from '@/features/orchestrator/components/platform-detail-parts'
import { PlatformGridPagination } from '@/features/orchestrator/components/platform-grid-pagination'
import { PlatformSelectionToolbar } from '@/features/orchestrator/components/platform-selection-toolbar'
import { useGridSelection } from '@/features/orchestrator/components/use-grid-selection'
import { toast } from '@/hooks/use-toast'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction,
  releaseDisplaySidecarSessionAction
} from '@/server/orchestrator/diagnostics/actions'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { DisplaySidecarSession, ServiceHealth } from '@/server/orchestrator/diagnostics/types'

const formatTimestamp = (value: string) => new Date(value).toLocaleString()
const castingMessage = (message: string) => message.replace(/display sidecar/gi, 'casting sidecar')
const castingErrorMessage = (error: unknown) => castingMessage(error instanceof Error ? error.message : 'Unknown error')
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

export const CastingSidecarSettings = ({
  initialHealth,
  initialSessions,
  applications,
  owners
}: {
  initialHealth: ServiceHealth
  initialSessions: DisplaySidecarSession[]
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
}) => {
  const [health, setHealth] = useState(initialHealth)
  const [sessions, setSessions] = useState(initialSessions)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const appsById = useMemo(() => new Map(applications.map(app => [app.id, app])), [applications])
  const ownerNames = useMemo(() => new Map(owners.map(owner => [owner.id, owner.name])), [owners])

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter(session => {
      const app = session.applicationId ? appsById.get(session.applicationId) : undefined
      return [session.id, session.applicationId, app?.name, session.ownerUserId, session.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [appsById, search, sessions])
  const paginatedSessions = useMemo(
    () => filteredSessions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredSessions, pageIndex, pageSize]
  )
  const selection = useGridSelection(filteredSessions)

  useEffect(() => setPageIndex(0), [search])
  useEffect(() => {
    const pageCount = Math.max(Math.ceil(filteredSessions.length / pageSize), 1)
    if (pageIndex >= pageCount) setPageIndex(pageCount - 1)
  }, [filteredSessions.length, pageIndex, pageSize])

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
    }
  }, [])

  useEffect(() => {
    const handleRestart = () => void refresh()
    window.addEventListener('rebroid:casting-sidecar-restarted', handleRestart)
    return () => window.removeEventListener('rebroid:casting-sidecar-restarted', handleRestart)
  }, [refresh])

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
      selection.clearSelection()
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

  return (
    <>
      <Section
        title='Casting sidecar'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <Badge
              className='capitalize'
              variant={health.ok ? 'status' : 'warning'}
            >
              {health.status}
            </Badge>
            <span className='text-sm text-secondary-foreground'>{castingMessage(health.message)}</span>
          </div>
          <Button
            type='button'
            variant='ghost'
            disabled={busy !== null}
            onClick={() => void refresh()}
          >
            {busy === 'refresh' ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />}
            Refresh
          </Button>
        </div>
        {health.details ? (
          <div className='rounded-lg border border-border/60 bg-background/25 px-4'>
            <div className='grid gap-x-8 xl:grid-cols-2'>
              {Object.entries(health.details).map(([key, value]) => (
                <PlatformDetailRow
                  key={key}
                  label={castingDetailLabels[key] ?? key}
                  value={value === null ? 'none' : String(value)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </Section>

      <Section
        title='Sessions'
        boxed
        titleClassName='pb-4'
        contentClassName='gap-4'
      >
        <PlatformSelectionToolbar
          search={search}
          placeholder='Search sessions'
          selectedCount={selection.selectedItems.length}
          onSearchChange={setSearch}
          actions={
            <Button
              type='button'
              variant='ghost'
              disabled={busy !== null || selection.selectedItems.length === 0}
              onClick={() => void killSessions(selection.selectedItems)}
            >
              Kill {selection.selectedItems.length || ''} session{selection.selectedItems.length === 1 ? '' : 's'}
            </Button>
          }
        />
        <div className='overflow-hidden rounded-lg border border-border/60 bg-background/25'>
          <Table
            className='table-fixed'
            style={{ minWidth: '76rem' }}
          >
            <TableHeader className='bg-background/45'>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='w-12 px-4 py-3'>
                  <Checkbox
                    checked={
                      paginatedSessions.length > 0 &&
                      paginatedSessions.every(session => selection.selectedIds.has(session.id))
                    }
                    onCheckedChange={checked => selection.selectPage(paginatedSessions, checked === true)}
                  />
                </TableHead>
                <TableHead className='w-[22rem] px-4 py-3 uppercase'>Application and user</TableHead>
                <TableHead className='w-[14rem] px-4 py-3 uppercase'>Session ID</TableHead>
                <TableHead className='w-28 px-4 py-3 uppercase'>Status</TableHead>
                <TableHead className='w-48 px-4 py-3 uppercase'>Last activity</TableHead>
                <TableHead className='w-48 px-4 py-3 uppercase'>Expires</TableHead>
                <TableHead className='w-40 px-4 py-3 text-right uppercase'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Visible when={filteredSessions.length === 0}>
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='px-4 py-4 text-secondary-foreground'
                  >
                    {search.trim() ? 'No sessions match this search.' : 'No casting sessions are known to the sidecar.'}
                  </TableCell>
                </TableRow>
              </Visible>
              {paginatedSessions.map((session, index) => {
                const app = session.applicationId ? appsById.get(session.applicationId) : undefined
                const ownerId = session.ownerUserId ?? app?.ownerUserId
                return (
                  <TableRow key={session.id}>
                    <TableCell className='px-4 py-3'>
                      <Checkbox
                        checked={selection.selectedIds.has(session.id)}
                        onClick={event =>
                          selection.toggleSelection(session, pageIndex * pageSize + index, event.shiftKey)
                        }
                        onCheckedChange={() => undefined}
                      />
                    </TableCell>
                    <TableCell className='px-4 py-3'>
                      <div className='flex min-w-0 flex-col gap-1'>
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
                            className='truncate text-xs text-muted-foreground hover:text-primary'
                            href={`/settings/users/${ownerId}`}
                          >
                            {ownerNames.get(ownerId) ?? ownerId}
                          </Link>
                        ) : (
                          <span className='text-xs text-muted-foreground'>Unknown user</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='truncate px-4 py-3 text-secondary-foreground'>{session.id}</TableCell>
                    <TableCell className='px-4 py-3'>
                      <Badge
                        className='capitalize'
                        variant={session.status === 'active' ? 'status' : 'secondary'}
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='px-4 py-3 text-secondary-foreground'>
                      {formatTimestamp(session.lastActivityAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-secondary-foreground'>
                      {formatTimestamp(session.expiresAt)}
                    </TableCell>
                    <TableCell className='px-4 py-3 text-right'>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        disabled={busy !== null || !activeStatuses.has(session.status)}
                        onClick={() => void killSessions([session])}
                      >
                        {busy === session.id ? (
                          <IconLoader2 className='size-4 animate-spin' />
                        ) : (
                          <IconTrash className='size-4' />
                        )}
                        Kill session
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <PlatformGridPagination
          totalItems={filteredSessions.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
        />
      </Section>
    </>
  )
}

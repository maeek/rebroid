'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRestore, IconTrash } from '@tabler/icons-react'
import { DataGrid, DataGridPagination, DataGridToolbar } from '@/components/data-grid'
import { Button } from '@/components/ui/button'
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
import { createCastingSessionColumns } from './casting-sessions-grid'
import {
  activeStatuses,
  castingDetailLabels,
  castingErrorMessage,
  castingMessage,
  filterSessions,
  formatHealthDetail,
  sortSessions
} from './casting-sidecar-utils'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { DisplaySidecarSession, ServiceHealth } from '@/server/orchestrator/diagnostics/types'
import type { SortingState } from '@tanstack/react-table'

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

  const filteredSessions = useMemo(
    () => filterSessions(sessions, appsById, submittedSearch),
    [appsById, sessions, submittedSearch]
  )
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

  const columns = useMemo(() => createCastingSessionColumns({ appsById, ownerNames }), [appsById, ownerNames])

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

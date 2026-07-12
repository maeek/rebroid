'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRestore, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import {
  getOrchestratorHealthAction,
  listDisplaySidecarSessionsAction,
  repairDisplaySidecarAction,
  releaseDisplaySidecarSessionAction
} from '@/server/orchestrator/diagnostics/actions'
import { DataGrid, DataGridPagination, DataGridWorkspace } from '@/shared/ui/data-grid'
import { PlatformDetailRow } from '@/shared/ui/platform/platform-detail-parts'
import { PlatformStatusBanner } from '@/shared/ui/platform/platform-status-banner'
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [applicationFilter, setApplicationFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastActivityAt', desc: true }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingEndSessions, setPendingEndSessions] = useState<DisplaySidecarSession[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const appsById = useMemo(() => new Map(applications.map(app => [app.id, app])), [applications])
  const ownerNames = useMemo(() => new Map(owners.map(owner => [owner.id, owner.name])), [owners])

  const filteredSessions = useMemo(
    () =>
      filterSessions(sessions, appsById, submittedSearch).filter(session => {
        if (statusFilter !== 'all' && session.status !== statusFilter) return false
        if (applicationFilter !== 'all' && session.applicationId !== applicationFilter) return false
        if (ownerFilter !== 'all' && session.ownerUserId !== ownerFilter) return false
        return true
      }),
    [applicationFilter, appsById, ownerFilter, sessions, statusFilter, submittedSearch]
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
        variant: 'danger'
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
        variant: 'danger'
      })
    } finally {
      setBusy(null)
    }
  }

  const endSessions = async () => {
    const targets = pendingEndSessions
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
      setPendingEndSessions([])
      toast({
        title: targets.length === 1 ? 'Display session ended' : 'Selected display sessions ended',
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Could not end display session',
        description: castingErrorMessage(error),
        variant: 'danger'
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
        surface='plain'
        title='Sessions'
        titleClassName='pb-2'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          search={search}
          searchPlaceholder='Search sessions'
          onSearchChange={setSearch}
          onSearch={value => setSubmittedSearch(value.trim())}
          filters={
            <>
              <FormField
                label='Status'
                layout='vertical'
              >
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any status</SelectItem>
                    {Array.from(new Set(sessions.map(session => session.status))).map(value => (
                      <SelectItem
                        key={value}
                        value={value}
                      >
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='Application'
                layout='vertical'
              >
                <Select
                  value={applicationFilter}
                  onValueChange={setApplicationFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any application</SelectItem>
                    {applications.map(application => (
                      <SelectItem
                        key={application.id}
                        value={application.id}
                      >
                        {application.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='Owner'
                layout='vertical'
              >
                <Select
                  value={ownerFilter}
                  onValueChange={setOwnerFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any owner</SelectItem>
                    {owners.map(owner => (
                      <SelectItem
                        key={owner.id}
                        value={owner.id}
                      >
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </>
          }
          activeFilters={[
            ...(statusFilter !== 'all'
              ? [{ id: 'status', label: 'Status', value: statusFilter, onRemove: () => setStatusFilter('all') }]
              : []),
            ...(applicationFilter !== 'all'
              ? [
                  {
                    id: 'application',
                    label: 'Application',
                    value: appsById.get(applicationFilter)?.name ?? applicationFilter,
                    onRemove: () => setApplicationFilter('all')
                  }
                ]
              : []),
            ...(ownerFilter !== 'all'
              ? [
                  {
                    id: 'owner',
                    label: 'Owner',
                    value: ownerNames.get(ownerFilter) ?? ownerFilter,
                    onRemove: () => setOwnerFilter('all')
                  }
                ]
              : [])
          ]}
          onResetFilters={() => {
            setStatusFilter('all')
            setApplicationFilter('all')
            setOwnerFilter('all')
          }}
          selectedCount={selectedSessions.length}
          bulkActions={
            <Button
              type='button'
              variant='secondary'
              disabled={busy !== null || selectedSessions.length === 0}
              onClick={() => setPendingEndSessions(selectedSessions)}
            >
              End {selectedSessions.length || ''} session{selectedSessions.length === 1 ? '' : 's'}
            </Button>
          }
        >
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
              <div className='text-center text-foreground-muted'>
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
                      onSelect={() => setPendingEndSessions(selectedSessions)}
                    >
                      <IconTrash className='mr-2 size-4' />
                      End selected ({selectedSessions.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem
                    disabled={busy !== null || !activeStatuses.has(row.original.status)}
                    onSelect={() => setPendingEndSessions([row.original])}
                  >
                    <IconTrash className='mr-2 size-4' />
                    End session
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
        </DataGridWorkspace>
      </Section>
      <ConfirmMutationDialog
        open={pendingEndSessions.length > 0}
        title={
          pendingEndSessions.length === 1
            ? 'End display session?'
            : `End ${pendingEndSessions.length} display sessions?`
        }
        description='This disconnects the selected live viewer session.'
        consequence='The application keeps running. A new viewer session can be opened later.'
        tone='warning'
        confirmLabel={pendingEndSessions.length === 1 ? 'End session' : 'End sessions'}
        pendingLabel='Ending…'
        pending={busy !== null}
        onOpenChange={open => {
          if (!open) setPendingEndSessions([])
        }}
        onConfirm={() => void endSessions()}
      />
    </>
  )
}

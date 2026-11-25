import { useMemo } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { createCastingSessionColumns } from './casting-sessions-grid'
import { activeStatuses } from './casting-sidecar-utils'
import type { CastingApplication } from './casting-sidecar-utils'
import type { CastingSidecarController } from './use-casting-sidecar-controller'

export const CastingSessionsSection = ({
  loading = false,
  controller,
  applications,
  owners
}: {
  loading?: boolean
  controller: CastingSidecarController
  applications: CastingApplication[]
  owners: Array<{ id: string; name: string }>
}) => {
  const {
    sessions,
    search,
    setSearch,
    setSubmittedSearch,
    statusFilter,
    setStatusFilter,
    applicationFilter,
    setApplicationFilter,
    ownerFilter,
    setOwnerFilter,
    sorting,
    setSorting,
    selectedIds,
    setSelectedIds,
    pendingEndSessions,
    setPendingEndSessions,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    appsById,
    paginatedSessions,
    selectedSessions,
    sortedSessions,
    busy,
    endSessions
  } = controller
  const ownerNames = useMemo(() => new Map(owners.map(owner => [owner.id, owner.name])), [owners])
  const columns = useMemo(() => createCastingSessionColumns({ appsById, ownerNames }), [appsById, ownerNames])
  const deviceNames = new Map(applications.map(device => [device.id, device.name]))
  for (const session of sessions) {
    if (session.provider === 'external' && session.applicationId) {
      deviceNames.set(session.applicationId, session.deviceName ?? session.applicationId)
    }
  }
  const canEndSelected = controller.health.ok || selectedSessions.every(session => session.provider === 'external')
  const canEndPending = controller.health.ok || pendingEndSessions.every(session => session.provider === 'external')

  return (
    <>
      <Section
        surface='plain'
        aria-label='Sessions'
        contentClassName='gap-4'
      >
        <DataGridWorkspace
          disabled={loading || (!controller.health.ok && !sessions.some(session => session.provider === 'external'))}
          search={search}
          searchPlaceholder='Search sessions'
          onSearchChange={setSearch}
          onSearch={value => setSubmittedSearch(value.trim())}
          filters={
            <>
              <FormField
                controlId='casting-session-status'
                label='Status'
                layout='vertical'
              >
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger
                    id='casting-session-status'
                    className='w-full'
                  >
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
                controlId='casting-session-application'
                label='Device'
                layout='vertical'
              >
                <Select
                  value={applicationFilter}
                  onValueChange={setApplicationFilter}
                >
                  <SelectTrigger
                    id='casting-session-application'
                    className='w-full'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any device</SelectItem>
                    {Array.from(deviceNames, ([id, name]) => (
                      <SelectItem
                        key={id}
                        value={id}
                      >
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                controlId='casting-session-owner'
                label='Owner'
                layout='vertical'
              >
                <Select
                  value={ownerFilter}
                  onValueChange={setOwnerFilter}
                >
                  <SelectTrigger
                    id='casting-session-owner'
                    className='w-full'
                  >
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
                    label: 'Device',
                    value: deviceNames.get(applicationFilter) ?? applicationFilter,
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
              variant='ghost'
              disabled={busy !== null || !canEndSelected || selectedSessions.length === 0}
              onClick={() => setPendingEndSessions(selectedSessions)}
            >
              End {selectedSessions.length || ''} session{selectedSessions.length === 1 ? '' : 's'}
            </Button>
          }
        >
          <DataGrid
            loading={loading}
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
            selection={{ disabled: loading, selectedIds, onSelectedIdsChange: setSelectedIds }}
            minWidth='76rem'
            emptyState={
              <DataGridEmptyState
                artwork='external-devices'
                title='No viewer sessions'
                description='Open a managed device or a verified external device in the viewer to start a session.'
              />
            }
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedSessions.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <ContextMenuItem
                      disabled={busy !== null || !canEndSelected}
                      onSelect={() => setPendingEndSessions(selectedSessions)}
                    >
                      <IconTrash className='size-4' />
                      End selected ({selectedSessions.length})
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem
                    disabled={
                      busy !== null ||
                      (!controller.health.ok && row.original.provider !== 'external') ||
                      !activeStatuses.has(row.original.status)
                    }
                    onSelect={() => setPendingEndSessions([row.original])}
                  >
                    <IconTrash className='size-4' />
                    End session
                  </ContextMenuItem>
                </>
              )
            }}
          />
          <DataGridPagination
            loading={loading}
            totalItems={sortedSessions.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={size => {
              setPageSize(size)
              setPageIndex(0)
            }}
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
        description='This disconnects the selected viewers. Their devices remain running.'
        tone='warning'
        confirmLabel={pendingEndSessions.length === 1 ? 'End session' : 'End sessions'}
        pendingLabel='Ending…'
        pending={busy !== null}
        confirmDisabled={!canEndPending}
        onOpenChange={open => {
          if (!open) setPendingEndSessions([])
        }}
        onConfirm={() => void endSessions()}
      />
    </>
  )
}

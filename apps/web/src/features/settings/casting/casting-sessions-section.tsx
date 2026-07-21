import { useMemo } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Section } from '@/components/ui/section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridPagination } from '@/shared/ui/data-grid/data-grid-pagination'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { createCastingSessionColumns } from './casting-sessions-grid'
import { activeStatuses } from './casting-sidecar-utils'
import type { CastingSidecarController } from './use-casting-sidecar-controller'
import type { AndroidApplication } from '@/shared/contracts/application'

export const CastingSessionsSection = ({
  controller,
  applications,
  owners
}: {
  controller: CastingSidecarController
  applications: Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId' | 'runtime'>[]
  owners: Array<{ id: string; name: string }>
}) => {
  const {
    sessions,
    search,
    setSearch,
    submittedSearch,
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

  return (
    <>
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
                label='Application'
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
            selection={{ selectedIds, onSelectedIdsChange: setSelectedIds }}
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

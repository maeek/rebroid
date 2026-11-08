'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useScheduledTasksControllerContext } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { sortTasks } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table-utils'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridEmptyState } from '@/shared/ui/data-grid/data-grid-empty-state'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import { scheduledTaskColumns } from './scheduled-task-columns'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'
import type { SortingState } from '@tanstack/react-table'

export const ScheduledTasksTable = ({ loading = false }: { loading?: boolean }) => {
  const { actionByType, busyTaskId, deleteTask, openEditForm, runNow, tasks, toggleEnabled } =
    useScheduledTasksControllerContext()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [enabledFilter, setEnabledFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [pendingDelete, setPendingDelete] = useState<ScheduledTask[]>([])
  const actionLabel = useCallback(
    (task: ScheduledTask) => actionByType.get(task.actionType)?.label ?? task.actionType,
    [actionByType]
  )
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tasks.filter(task => {
      if (query && !`${task.name} ${actionLabel(task)} ${task.lastError ?? ''}`.toLowerCase().includes(query))
        return false
      if (kindFilter !== 'all' && task.kind !== kindFilter) return false
      if (enabledFilter === 'enabled' && !task.enabled) return false
      if (enabledFilter === 'paused' && task.enabled) return false
      if (statusFilter !== 'all' && task.lastStatus !== statusFilter) return false
      return true
    })
  }, [actionLabel, enabledFilter, kindFilter, search, statusFilter, tasks])
  const sortedTasks = useMemo(
    () => sortTasks(filteredTasks, sorting, actionLabel),
    [actionLabel, filteredTasks, sorting]
  )
  const selectedTasks = sortedTasks.filter(task => selectedIds.has(task.id))
  const selectedTasksAreCustom = selectedTasks.every(task => task.kind === 'custom')

  useEffect(() => {
    const taskIds = new Set(tasks.map(task => task.id))
    setSelectedIds(current => new Set(Array.from(current).filter(id => taskIds.has(id))))
  }, [tasks])

  const runSelected = async () => {
    for (const task of selectedTasks) {
      await runNow(task)
    }
  }

  const updateSelectedEnabled = async (enabled: boolean) => {
    for (const task of selectedTasks) {
      await toggleEnabled(task, enabled)
    }
  }

  const confirmDelete = async () => {
    for (const task of pendingDelete) {
      await deleteTask(task)
    }
    setSelectedIds(new Set())
    setPendingDelete([])
  }

  const columns = useMemo(
    () => scheduledTaskColumns({ actionLabel, busyTaskId, openEditForm, toggleEnabled }),
    [actionLabel, busyTaskId, openEditForm, toggleEnabled]
  )

  return (
    <>
      <div
        className='grid gap-3'
        data-testid={loading ? 'scheduler-grid-skeleton' : undefined}
      >
        <DataGridWorkspace
          disabled={loading}
          filterTitle='Filter scheduled tasks'
          search={searchDraft}
          searchPlaceholder='Search scheduled tasks'
          onSearchChange={setSearchDraft}
          onSearch={setSearch}
          filters={
            <>
              <FormField
                label='Kind'
                layout='vertical'
              >
                <Select
                  value={kindFilter}
                  onValueChange={setKindFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any kind</SelectItem>
                    <SelectItem value='predefined'>Built-in</SelectItem>
                    <SelectItem value='custom'>Custom</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='State'
                layout='vertical'
              >
                <Select
                  value={enabledFilter}
                  onValueChange={setEnabledFilter}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Any state</SelectItem>
                    <SelectItem value='enabled'>Enabled</SelectItem>
                    <SelectItem value='paused'>Paused</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label='Last result'
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
                    <SelectItem value='all'>Any result</SelectItem>
                    <SelectItem value='never_run'>Never run</SelectItem>
                    <SelectItem value='success'>Success</SelectItem>
                    <SelectItem value='failed'>Failed</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </>
          }
          activeFilters={[
            ...(kindFilter !== 'all'
              ? [
                  {
                    id: 'kind',
                    label: 'Kind',
                    value: kindFilter === 'predefined' ? 'Built-in' : 'Custom',
                    onRemove: () => setKindFilter('all')
                  }
                ]
              : []),
            ...(enabledFilter !== 'all'
              ? [
                  {
                    id: 'enabled',
                    label: 'State',
                    value: enabledFilter === 'enabled' ? 'Enabled' : 'Paused',
                    onRemove: () => setEnabledFilter('all')
                  }
                ]
              : []),
            ...(statusFilter !== 'all'
              ? [
                  {
                    id: 'status',
                    label: 'Result',
                    value: statusFilter === 'never_run' ? 'Never run' : statusFilter,
                    onRemove: () => setStatusFilter('all')
                  }
                ]
              : [])
          ]}
          onResetFilters={() => {
            setKindFilter('all')
            setEnabledFilter('all')
            setStatusFilter('all')
          }}
          selectedCount={selectedTasks.length}
          bulkActions={
            <>
              <Button
                size='sm'
                variant='ghost'
                disabled={busyTaskId !== null}
                onClick={() => void runSelected()}
              >
                Run
              </Button>
              <Button
                size='sm'
                variant='ghost'
                disabled={busyTaskId !== null}
                onClick={() => void updateSelectedEnabled(true)}
              >
                Enable
              </Button>
              <Button
                size='sm'
                variant='ghost'
                disabled={busyTaskId !== null}
                onClick={() => void updateSelectedEnabled(false)}
              >
                Disable
              </Button>
              <Button
                size='sm'
                variant='danger-ghost'
                disabled={busyTaskId !== null || !selectedTasksAreCustom}
                onClick={() => setPendingDelete(selectedTasks)}
              >
                <IconTrash className='size-4' />
                Delete
              </Button>
            </>
          }
        >
          <DataGrid
            columns={columns}
            data={sortedTasks}
            totalItems={sortedTasks.length}
            pageIndex={0}
            pageSize={Math.max(sortedTasks.length, 1)}
            getRowId={task => task.id}
            sorting={sorting}
            onSortingChange={updater =>
              setSorting(current => (typeof updater === 'function' ? updater(current) : updater))
            }
            selection={{
              selectedIds,
              onSelectedIdsChange: setSelectedIds
            }}
            minWidth='66.5rem'
            loading={loading ? { rowCount: 5, selectable: true, rowMenu: true } : false}
            emptyState={
              <DataGridEmptyState
                title='No scheduled tasks yet'
                description='Create a task to run maintenance on a schedule.'
              />
            }
            rowContextMenu={row => {
              const hasBulkSelection = selectedIds.has(row.original.id) && selectedTasks.length > 1
              return (
                <>
                  {hasBulkSelection ? (
                    <>
                      <ContextMenuItem
                        disabled={busyTaskId !== null}
                        onSelect={() => void runSelected()}
                      >
                        <IconPlayerPlayFilled className='mr-2 size-4' />
                        Run selected ({selectedTasks.length})
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={busyTaskId !== null}
                        onSelect={() => void updateSelectedEnabled(true)}
                      >
                        Enable selected ({selectedTasks.length})
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={busyTaskId !== null}
                        onSelect={() => void updateSelectedEnabled(false)}
                      >
                        Disable selected ({selectedTasks.length})
                      </ContextMenuItem>
                      <ContextMenuItem
                        className='text-danger focus:text-danger'
                        disabled={busyTaskId !== null || !selectedTasksAreCustom}
                        onSelect={() => setPendingDelete(selectedTasks)}
                      >
                        <IconTrash className='mr-2 size-4' />
                        Delete selected ({selectedTasks.length})
                      </ContextMenuItem>
                    </>
                  ) : null}
                  <ContextMenuItem onSelect={() => openEditForm(row.original)}>
                    <IconEdit className='mr-2 size-4' />
                    Edit
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => void runNow(row.original)}>
                    <IconPlayerPlayFilled className='mr-2 size-4' />
                    Run now
                  </ContextMenuItem>
                  {row.original.kind === 'custom' ? (
                    <ContextMenuItem
                      className='text-danger focus:text-danger'
                      onSelect={() => setPendingDelete([row.original])}
                    >
                      <IconTrash className='mr-2 size-4' />
                      Delete
                    </ContextMenuItem>
                  ) : null}
                </>
              )
            }}
          />
        </DataGridWorkspace>
      </div>
      <ConfirmMutationDialog
        open={pendingDelete.length > 0}
        title={
          pendingDelete.length === 1 ? 'Delete scheduled task?' : `Delete ${pendingDelete.length} scheduled tasks?`
        }
        description='This permanently removes the selected custom task configuration.'
        summary={pendingDelete.length === 1 ? pendingDelete[0]?.name : undefined}
        consequence='The task will no longer run on its schedule. Existing run history is retained.'
        confirmLabel={pendingDelete.length === 1 ? 'Delete task' : 'Delete tasks'}
        pendingLabel='Deleting…'
        pending={busyTaskId !== null}
        onOpenChange={open => {
          if (!open) setPendingDelete([])
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

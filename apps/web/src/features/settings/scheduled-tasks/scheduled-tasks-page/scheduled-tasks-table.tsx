'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmMutationDialog } from '@/components/ui/confirm-mutation-dialog'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import {
  dateLabel,
  scheduleLabel,
  statusLabel,
  statusVariant
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { useScheduledTasksControllerContext } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { sortTasks } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table-utils'
import { DataGrid } from '@/shared/ui/data-grid/data-grid'
import { DataGridWorkspace } from '@/shared/ui/data-grid/data-grid-workspace'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

export const ScheduledTasksTable = () => {
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

  const columns = useMemo<ColumnDef<ScheduledTask>[]>(
    () => [
      {
        id: 'name',
        accessorFn: task => task.name,
        header: 'Task',
        size: 384,
        meta: { label: 'Task', skeleton: { kind: 'stacked' } },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium text-foreground'>{row.original.name}</span>
              <Badge variant='neutral'>{row.original.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
            </div>
            <span className='text-foreground-muted'>{actionLabel(row.original)}</span>
            <Visible when={row.original.lastError}>
              <span className='max-w-lg truncate text-danger'>{row.original.lastError}</span>
            </Visible>
          </div>
        )
      },
      {
        id: 'state',
        accessorFn: task => `${task.enabled ? 'enabled' : 'paused'}:${task.lastStatus}`,
        header: 'State',
        size: 176,
        meta: { label: 'State', skeleton: { kind: 'badge', width: 'w-28' } },
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-2'>
            <Badge variant={row.original.enabled ? 'success' : 'neutral'}>
              {row.original.enabled ? 'Enabled' : 'Paused'}
            </Badge>
            <Badge variant={statusVariant(row.original.lastStatus)}>{statusLabel(row.original.lastStatus)}</Badge>
          </div>
        )
      },
      {
        id: 'schedule',
        accessorFn: task => task.cronExpression,
        header: 'Schedule',
        size: 176,
        meta: { label: 'Schedule', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => (
          <span className='text-sm text-foreground-muted'>{scheduleLabel(row.original.cronExpression)}</span>
        )
      },
      {
        id: 'nextRunAt',
        accessorFn: task => task.nextRunAt ?? '',
        header: 'Next run',
        size: 176,
        meta: { label: 'Next run', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{dateLabel(row.original.nextRunAt)}</span>
      },
      {
        id: 'lastRunAt',
        accessorFn: task => task.lastRunAt ?? '',
        header: 'Last run',
        size: 176,
        meta: { label: 'Last run', skeleton: { kind: 'text', width: 'w-32' } },
        cell: ({ row }) => <span className='text-sm text-foreground-muted'>{dateLabel(row.original.lastRunAt)}</span>
      },
      {
        id: 'enabled',
        accessorFn: task => task.enabled,
        header: 'Enabled',
        size: 112,
        meta: { label: 'Enabled', skeleton: { kind: 'text', width: 'w-12' } },
        cell: ({ row }) => (
          <div className='flex justify-center'>
            <Switch
              checked={row.original.enabled}
              disabled={busyTaskId === row.original.id}
              aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
              onCheckedChange={enabled => void toggleEnabled(row.original, enabled)}
            />
          </div>
        )
      }
    ],
    [actionLabel, busyTaskId, toggleEnabled]
  )

  return (
    <>
      <div className='grid gap-3'>
        <DataGridWorkspace
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
              ? [{ id: 'kind', label: 'Kind', value: kindFilter, onRemove: () => setKindFilter('all') }]
              : []),
            ...(enabledFilter !== 'all'
              ? [{ id: 'enabled', label: 'State', value: enabledFilter, onRemove: () => setEnabledFilter('all') }]
              : []),
            ...(statusFilter !== 'all'
              ? [{ id: 'status', label: 'Result', value: statusFilter, onRemove: () => setStatusFilter('all') }]
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
                variant='secondary'
                disabled={busyTaskId !== null}
                onClick={() => void runSelected()}
              >
                Run
              </Button>
              <Button
                size='sm'
                variant='secondary'
                disabled={busyTaskId !== null}
                onClick={() => void updateSelectedEnabled(true)}
              >
                Enable
              </Button>
              <Button
                size='sm'
                variant='secondary'
                disabled={busyTaskId !== null}
                onClick={() => void updateSelectedEnabled(false)}
              >
                Disable
              </Button>
              <Button
                size='sm'
                variant='danger'
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
            minWidth='82rem'
            emptyState={<div className='text-center text-foreground-muted'>No scheduled tasks configured.</div>}
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

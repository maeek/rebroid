'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { DataGrid } from '@/components/data-grid'
import { Badge } from '@/components/ui/badge'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import {
  dateLabel,
  scheduleLabel,
  statusLabel,
  statusVariant
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { useScheduledTasksControllerContext } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import {
  ScheduledTaskBulkBar,
  ScheduledTaskMobileCard
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table-parts'
import { sortTasks } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table-utils'
import type { ScheduledTask } from '@/server/orchestrator/scheduled-tasks/types'
import type { ColumnDef, SortingState } from '@tanstack/react-table'

export const ScheduledTasksTable = () => {
  const { actionByType, busyTaskId, deleteTask, openEditForm, runNow, tasks, toggleEnabled } =
    useScheduledTasksControllerContext()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const actionLabel = useCallback(
    (task: ScheduledTask) => actionByType.get(task.actionType)?.label ?? task.actionType,
    [actionByType]
  )
  const sortedTasks = useMemo(() => sortTasks(tasks, sorting, actionLabel), [actionLabel, sorting, tasks])
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

  const deleteSelected = async () => {
    for (const task of selectedTasks) {
      await deleteTask(task)
    }
    setSelectedIds(new Set())
  }

  const columns = useMemo<ColumnDef<ScheduledTask>[]>(
    () => [
      {
        id: 'name',
        accessorFn: task => task.name,
        header: 'Task',
        size: 384,
        meta: { label: 'Task' },
        cell: ({ row }) => (
          <div className='grid gap-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='font-medium text-foreground'>{row.original.name}</span>
              <Badge variant='secondary'>{row.original.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
            </div>
            <span className='text-secondary-foreground'>{actionLabel(row.original)}</span>
            <Visible when={row.original.lastError}>
              <span className='max-w-lg truncate text-destructive'>{row.original.lastError}</span>
            </Visible>
          </div>
        )
      },
      {
        id: 'state',
        accessorFn: task => `${task.enabled ? 'enabled' : 'paused'}:${task.lastStatus}`,
        header: 'State',
        size: 176,
        meta: { label: 'State' },
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-2'>
            <Badge variant={row.original.enabled ? 'status' : 'secondary'}>
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
        meta: { label: 'Schedule' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{scheduleLabel(row.original.cronExpression)}</span>
        )
      },
      {
        id: 'nextRunAt',
        accessorFn: task => task.nextRunAt ?? '',
        header: 'Next run',
        size: 176,
        meta: { label: 'Next run' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{dateLabel(row.original.nextRunAt)}</span>
        )
      },
      {
        id: 'lastRunAt',
        accessorFn: task => task.lastRunAt ?? '',
        header: 'Last run',
        size: 176,
        meta: { label: 'Last run' },
        cell: ({ row }) => (
          <span className='text-sm text-secondary-foreground'>{dateLabel(row.original.lastRunAt)}</span>
        )
      },
      {
        id: 'enabled',
        accessorFn: task => task.enabled,
        header: 'Enabled',
        size: 112,
        meta: { label: 'Enabled' },
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
    <div className='grid gap-3'>
      <ScheduledTaskBulkBar
        busy={busyTaskId !== null}
        canDelete={selectedTasksAreCustom}
        selectedCount={selectedTasks.length}
        onDelete={() => void deleteSelected()}
        onDisable={() => void updateSelectedEnabled(false)}
        onEnable={() => void updateSelectedEnabled(true)}
        onRun={() => void runSelected()}
      />
      <DataGrid
        columns={columns}
        data={sortedTasks}
        totalItems={sortedTasks.length}
        pageIndex={0}
        pageSize={Math.max(sortedTasks.length, 1)}
        getRowId={task => task.id}
        sorting={sorting}
        onSortingChange={updater => setSorting(current => (typeof updater === 'function' ? updater(current) : updater))}
        selection={{
          selectedIds,
          onSelectedIdsChange: setSelectedIds
        }}
        minWidth='82rem'
        emptyState={<div className='text-center text-secondary-foreground'>No scheduled tasks configured.</div>}
        mobileCard={row => (
          <ScheduledTaskMobileCard
            key={row.original.id}
            task={row.original}
            actionLabel={actionLabel(row.original)}
            busy={busyTaskId === row.original.id}
            selected={selectedIds.has(row.original.id)}
            onSelectedChange={selected => {
              const next = new Set(selectedIds)
              if (selected) next.add(row.original.id)
              else next.delete(row.original.id)
              setSelectedIds(next)
            }}
            onToggleEnabled={enabled => void toggleEnabled(row.original, enabled)}
          />
        )}
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
                    className='text-destructive focus:text-destructive'
                    disabled={busyTaskId !== null || !selectedTasksAreCustom}
                    onSelect={() => void deleteSelected()}
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
                  className='text-destructive focus:text-destructive'
                  onSelect={() => void deleteTask(row.original)}
                >
                  <IconTrash className='mr-2 size-4' />
                  Delete
                </ContextMenuItem>
              ) : null}
            </>
          )
        }}
      />
    </div>
  )
}

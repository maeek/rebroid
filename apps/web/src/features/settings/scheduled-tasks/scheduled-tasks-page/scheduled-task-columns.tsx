import { Button } from '@/components/ui/button'
import { MutationSwitch } from '@/components/ui/mutation-switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ScheduleValue } from '@/shared/ui/schedule/schedule-value'
import { actionKeepsHistory, defaultRetentionDaysFor } from './schedule-utils'
import { ScheduledTaskLastRun } from './scheduled-task-last-run'
import { useScheduledTasksControllerContext } from './scheduled-tasks-context'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'
import type { CellContext, ColumnDef } from '@tanstack/react-table'
import styles from '@/shared/ui/data-grid/data-grid-table.module.css'

const ScheduledTaskEnabledCell = ({ row }: CellContext<ScheduledTask, unknown>) => {
  const { busyTaskId, toggleEnabled, toggleFeedback } = useScheduledTasksControllerContext()
  return (
    <MutationSwitch
      checked={row.original.enabled}
      pending={toggleFeedback?.pendingId === row.original.id}
      success={toggleFeedback?.savedId === row.original.id}
      disabled={busyTaskId !== null}
      aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
      onCheckedChange={enabled => void toggleEnabled(row.original, enabled)}
    />
  )
}

export const scheduledTaskColumns = ({
  actionLabel,
  openEditForm
}: {
  actionLabel: (task: ScheduledTask) => string
  openEditForm: (task: ScheduledTask) => void
}): ColumnDef<ScheduledTask>[] => [
  {
    id: 'name',
    accessorFn: task => task.name,
    header: 'Task',
    size: 288,
    enableHiding: false,
    meta: { label: 'Task', compactSlot: 'title', skeleton: { kind: 'stacked' } },
    cell: ({ row: { original: task } }) => {
      const action = actionLabel(task)
      const showAction = task.kind === 'custom' && action.trim().toLowerCase() !== task.name.trim().toLowerCase()
      return (
        <div className={cn('grid min-w-0 gap-1', styles.settingsStack)}>
          <Button
            type='button'
            variant='link'
            className='h-auto justify-start whitespace-normal p-0 text-left wrap-anywhere'
            onClick={() => openEditForm(task)}
          >
            {task.name}
          </Button>
          <span className={cn('text-xs text-foreground-muted', styles.settingsWideOnly)}>
            {task.kind === 'predefined' ? 'Built-in' : 'Custom'}
            {showAction ? ` · ${action}` : null}
            {actionKeepsHistory(task.actionType)
              ? ` · ${task.payload?.retentionDays ?? defaultRetentionDaysFor(task.actionType)} days`
              : null}
          </span>
        </div>
      )
    }
  },
  {
    id: 'enabled',
    accessorFn: task => task.enabled,
    header: 'Enabled',
    size: 88,
    enableHiding: false,
    meta: {
      label: 'Enabled',
      compactSlot: 'control',
      skeleton: { kind: 'custom', render: () => <Skeleton className='h-5 w-9 rounded-full' /> }
    },
    cell: ScheduledTaskEnabledCell
  },
  {
    id: 'schedule',
    accessorFn: task => task.cronExpression,
    header: 'Schedule',
    size: 192,
    meta: { label: 'Schedule', compactSlot: 'details', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => (
      <ScheduleValue
        expression={row.original.cronExpression}
        className={styles.settingsInline}
      />
    )
  },
  {
    id: 'nextRunAt',
    accessorFn: task => (task.enabled ? (task.nextRunAt ?? '') : ''),
    header: 'Next run',
    size: 192,
    meta: { label: 'Next run', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => (
      <DateTimeValue
        value={row.original.enabled ? row.original.nextRunAt : null}
        emptyLabel='No scheduled run'
      />
    )
  },
  {
    id: 'lastRunAt',
    accessorFn: task => task.lastRunAt ?? '',
    header: 'Last run',
    size: 208,
    meta: { label: 'Last run', compactSlot: 'details', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => <ScheduledTaskLastRun task={row.original} />
  }
]

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { ScheduleValue } from '@/shared/ui/schedule/schedule-value'
import { actionKeepsHistory, defaultRetentionDaysFor } from './schedule-utils'
import { ScheduledTaskLastRun } from './scheduled-task-last-run'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'
import type { ColumnDef } from '@tanstack/react-table'

export const scheduledTaskColumns = ({
  actionLabel,
  busyTaskId,
  openEditForm,
  toggleEnabled
}: {
  actionLabel: (task: ScheduledTask) => string
  busyTaskId: string | null
  openEditForm: (task: ScheduledTask) => void
  toggleEnabled: (task: ScheduledTask, enabled: boolean) => Promise<void>
}): ColumnDef<ScheduledTask>[] => [
  {
    id: 'name',
    accessorFn: task => task.name,
    header: 'Task',
    size: 288,
    meta: { label: 'Task', skeleton: { kind: 'stacked' } },
    cell: ({ row: { original: task } }) => {
      const action = actionLabel(task)
      const showAction = task.kind === 'custom' && action.trim().toLowerCase() !== task.name.trim().toLowerCase()
      return (
        <div className='grid min-w-0 gap-1'>
          <Button
            type='button'
            variant='link'
            className='h-auto justify-start whitespace-normal p-0 text-left'
            onClick={() => openEditForm(task)}
          >
            {task.name}
          </Button>
          <span className='text-xs text-foreground-muted'>
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
    meta: { label: 'Enabled', skeleton: { kind: 'text', width: 'w-12' } },
    cell: ({ row }) => (
      <Switch
        checked={row.original.enabled}
        disabled={busyTaskId === row.original.id}
        aria-label={`${row.original.enabled ? 'Disable' : 'Enable'} ${row.original.name}`}
        onCheckedChange={enabled => void toggleEnabled(row.original, enabled)}
      />
    )
  },
  {
    id: 'schedule',
    accessorFn: task => task.cronExpression,
    header: 'Schedule',
    size: 192,
    meta: { label: 'Schedule', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => <ScheduleValue expression={row.original.cronExpression} />
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
    meta: { label: 'Last run', skeleton: { kind: 'stacked' } },
    cell: ({ row }) => <ScheduledTaskLastRun task={row.original} />
  }
]

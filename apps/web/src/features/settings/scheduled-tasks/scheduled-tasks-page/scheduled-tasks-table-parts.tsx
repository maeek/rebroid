import { IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Visible } from '@/components/ui/visible'
import {
  dateLabel,
  scheduleLabel,
  statusLabel,
  statusVariant
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import type { ScheduledTask } from '@/server/orchestrator/scheduled-tasks/types'

export const ScheduledTaskBulkBar = ({
  busy,
  canDelete,
  selectedCount,
  onDelete,
  onDisable,
  onEnable,
  onRun
}: {
  busy: boolean
  canDelete: boolean
  selectedCount: number
  onDelete: () => void
  onDisable: () => void
  onEnable: () => void
  onRun: () => void
}) =>
  selectedCount > 0 ? (
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card/40 px-4 py-3 text-sm'>
      <span className='text-secondary-foreground'>{selectedCount} selected</span>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onRun}
        >
          <IconPlayerPlayFilled className='size-4' />
          Run selected
        </Button>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onEnable}
        >
          Enable selected
        </Button>
        <Button
          type='button'
          variant='secondary'
          disabled={busy}
          onClick={onDisable}
        >
          Disable selected
        </Button>
        <Button
          type='button'
          variant='destructive'
          disabled={busy || !canDelete}
          onClick={onDelete}
        >
          <IconTrash className='size-4' />
          Delete selected
        </Button>
      </div>
    </div>
  ) : null

export const ScheduledTaskMobileCard = ({
  task,
  actionLabel,
  busy,
  selected,
  onSelectedChange,
  onToggleEnabled
}: {
  task: ScheduledTask
  actionLabel: string
  busy: boolean
  selected: boolean
  onSelectedChange: (selected: boolean) => void
  onToggleEnabled: (enabled: boolean) => void
}) => (
  <div className='grid gap-4 rounded-lg border border-border/70 bg-background/25 p-4'>
    <div className='flex min-w-0 items-start justify-between gap-3'>
      <div className='flex min-w-0 items-start gap-3'>
        <Checkbox
          checked={selected}
          aria-label='Select scheduled task'
          onCheckedChange={checked => onSelectedChange(checked === true)}
        />
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='font-medium text-foreground'>{task.name}</h3>
            <Badge variant='secondary'>{task.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
          </div>
          <p className='mt-1 text-sm text-secondary-foreground'>{actionLabel}</p>
        </div>
      </div>
      <Switch
        checked={task.enabled}
        disabled={busy}
        aria-label={`${task.enabled ? 'Disable' : 'Enable'} ${task.name}`}
        onCheckedChange={onToggleEnabled}
      />
    </div>
    <div className='flex flex-wrap gap-2'>
      <Badge variant={task.enabled ? 'status' : 'secondary'}>{task.enabled ? 'Enabled' : 'Paused'}</Badge>
      <Badge variant={statusVariant(task.lastStatus)}>{statusLabel(task.lastStatus)}</Badge>
    </div>
    <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
      <div className='col-span-2 grid gap-1'>
        <dt className='text-secondary-foreground'>Schedule</dt>
        <dd className='text-foreground'>{scheduleLabel(task.cronExpression)}</dd>
      </div>
      <div className='grid gap-1'>
        <dt className='text-secondary-foreground'>Next</dt>
        <dd className='text-foreground'>{dateLabel(task.nextRunAt)}</dd>
      </div>
      <div className='grid gap-1'>
        <dt className='text-secondary-foreground'>Last</dt>
        <dd className='text-foreground'>{dateLabel(task.lastRunAt)}</dd>
      </div>
      <Visible when={task.lastError}>
        <div className='col-span-2 grid gap-1'>
          <dt className='text-secondary-foreground'>Error</dt>
          <dd className='text-destructive'>{task.lastError}</dd>
        </div>
      </Visible>
    </dl>
  </div>
)

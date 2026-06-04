'use client'

import { IconEdit, IconPlayerPlayFilled, IconTrash } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Visible } from '@/components/ui/visible'
import {
  dateLabel,
  scheduleLabel,
  statusLabel,
  statusVariant
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/schedule-utils'
import { useScheduledTasksControllerContext } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'

export const ScheduledTasksTable = () => {
  const { actionByType, busyTaskId, deleteTask, openEditForm, runNow, tasks, toggleEnabled } =
    useScheduledTasksControllerContext()

  return (
    <>
      <div className='hidden lg:block'>
        <Table>
          <TableHeader className='bg-secondary/18'>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='px-5'>Task</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead className='text-center'>Enabled</TableHead>
              <TableHead className='px-5 text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <Visible when={tasks.length === 0}>
              <TableRow>
                <TableCell
                  colSpan={7}
                  className='px-5 py-8 text-center text-secondary-foreground'
                >
                  No scheduled tasks configured.
                </TableCell>
              </TableRow>
            </Visible>
            {tasks.map(task => (
              <TableRow
                key={task.id}
                className='hover:bg-secondary/22'
              >
                <TableCell className='min-w-64 px-5 py-4'>
                  <div className='grid gap-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium text-foreground'>{task.name}</span>
                      <Badge variant='secondary'>{task.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
                    </div>
                    <span className='text-secondary-foreground'>
                      {actionByType.get(task.actionType)?.label ?? task.actionType}
                    </span>
                    <Visible when={task.lastError}>
                      <span className='max-w-lg truncate text-destructive'>{task.lastError}</span>
                    </Visible>
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant={task.enabled ? 'status' : 'secondary'}>{task.enabled ? 'Enabled' : 'Paused'}</Badge>
                    <Badge variant={statusVariant(task.lastStatus)}>{statusLabel(task.lastStatus)}</Badge>
                  </div>
                </TableCell>
                <TableCell className='min-w-44 text-secondary-foreground'>
                  {scheduleLabel(task.cronExpression)}
                </TableCell>
                <TableCell className='min-w-44 text-secondary-foreground'>{dateLabel(task.nextRunAt)}</TableCell>
                <TableCell className='min-w-44 text-secondary-foreground'>{dateLabel(task.lastRunAt)}</TableCell>
                <TableCell className='text-center'>
                  <Switch
                    checked={task.enabled}
                    disabled={busyTaskId === task.id}
                    aria-label={`${task.enabled ? 'Disable' : 'Enable'} ${task.name}`}
                    onCheckedChange={enabled => void toggleEnabled(task, enabled)}
                  />
                </TableCell>
                <TableCell className='px-5'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      size='sm'
                      variant='ghost'
                      disabled={busyTaskId === task.id}
                      onClick={() => openEditForm(task)}
                    >
                      <IconEdit className='size-4' />
                      Edit
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      disabled={busyTaskId === task.id}
                      onClick={() => void runNow(task)}
                    >
                      <IconPlayerPlayFilled className='size-4' />
                      Run
                    </Button>
                    <Visible when={task.kind === 'custom'}>
                      <Button
                        size='sm'
                        variant='ghost'
                        aria-label={`Delete ${task.name}`}
                        disabled={busyTaskId === task.id}
                        onClick={() => void deleteTask(task)}
                      >
                        <IconTrash className='size-4 text-destructive' />
                      </Button>
                    </Visible>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className='lg:hidden'>
        <Visible when={tasks.length === 0}>
          <p className='px-4 py-8 text-center text-sm text-secondary-foreground'>No scheduled tasks configured.</p>
        </Visible>
        {tasks.map(task => (
          <div
            key={task.id}
            className='grid gap-4 border-b border-border/60 px-4 py-4 last:border-b-0'
          >
            <div className='flex min-w-0 items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h3 className='font-medium text-foreground'>{task.name}</h3>
                  <Badge variant='secondary'>{task.kind === 'predefined' ? 'Built-in' : 'Custom'}</Badge>
                </div>
                <p className='mt-1 text-sm text-secondary-foreground'>
                  {actionByType.get(task.actionType)?.label ?? task.actionType}
                </p>
              </div>
              <Switch
                checked={task.enabled}
                disabled={busyTaskId === task.id}
                aria-label={`${task.enabled ? 'Disable' : 'Enable'} ${task.name}`}
                onCheckedChange={enabled => void toggleEnabled(task, enabled)}
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
            <div className='flex flex-wrap gap-2'>
              <Button
                size='sm'
                variant='secondary'
                disabled={busyTaskId === task.id}
                onClick={() => openEditForm(task)}
              >
                <IconEdit className='size-4' />
                Edit
              </Button>
              <Button
                size='sm'
                variant='secondary'
                disabled={busyTaskId === task.id}
                onClick={() => void runNow(task)}
              >
                <IconPlayerPlayFilled className='size-4' />
                Run now
              </Button>
              <Visible when={task.kind === 'custom'}>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={busyTaskId === task.id}
                  onClick={() => void deleteTask(task)}
                >
                  <IconTrash className='size-4 text-destructive' />
                  Delete
                </Button>
              </Visible>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

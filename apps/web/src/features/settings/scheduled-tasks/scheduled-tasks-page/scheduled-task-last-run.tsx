'use client'

import { IconCircleCheck, IconAlertCircle, IconChevronRight, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Notice } from '@/components/ui/notice'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { DetailFields } from '@/shared/ui/detail-fields'
import { useScheduledTasksControllerContext } from './scheduled-tasks-context'
import type { ScheduledTask } from '@/shared/contracts/scheduled-task'

export const ScheduledTaskLastRun = ({ task }: { task: ScheduledTask }) => {
  const { runningTaskId } = useScheduledTasksControllerContext()
  if (runningTaskId === task.id) {
    return (
      <span
        role='status'
        aria-label={`Running ${task.name}`}
        className='flex items-center gap-1 text-foreground-muted'
      >
        <IconLoader2
          aria-hidden
          className='size-4 motion-safe:animate-spin'
        />
        Running…
      </span>
    )
  }
  if (task.lastStatus === 'never_run') return <span className='text-foreground-muted'>Never run</span>
  return (
    <div className='grid justify-items-start gap-1'>
      {task.lastStatus === 'failed' ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type='button'
              variant='link'
              className='h-auto gap-1 p-0 text-danger'
              aria-label={`View failed run for ${task.name}`}
            >
              <IconAlertCircle
                aria-hidden='true'
                className='size-4'
              />
              Failed
              <IconChevronRight
                aria-hidden='true'
                className='size-3'
              />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Last run failed</DialogTitle>
              <DialogDescription>{task.name}</DialogDescription>
            </DialogHeader>
            <DetailFields
              fields={[{ label: 'Run time', value: task.lastRunAt ? new Date(task.lastRunAt).toLocaleString() : '-' }]}
            />
            <Notice
              tone='danger'
              title='Failure details'
              description={task.lastError ?? 'No error details were recorded.'}
              live='off'
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant='secondary'>Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <span className='flex items-center gap-1 text-success'>
          <IconCircleCheck
            aria-hidden='true'
            className='size-4'
          />
          Success
        </span>
      )}
      <DateTimeValue
        value={task.lastRunAt}
        compact
      />
    </div>
  )
}

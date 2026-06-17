'use client'

import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ScheduledTaskFormDialog } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-task-form-dialog'
import {
  ScheduledTasksProvider,
  useScheduledTasksControllerContext
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { ScheduledTasksTable } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table'
import { PlatformPageHeader } from '@/shared/ui/page/platform-page-header'
import { ProtectedStackPageLayout } from '@/shared/ui/page/protected-page-shell'
import type { ScheduledTasksPageProps } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'

export function ScheduledTasksPage(props: ScheduledTasksPageProps) {
  return (
    <ScheduledTasksProvider value={props}>
      <ScheduledTasksPageContent />
    </ScheduledTasksProvider>
  )
}

const ScheduledTasksPageContent = () => {
  const controller = useScheduledTasksControllerContext()

  return (
    <ProtectedStackPageLayout mainClassName='gap-2'>
      <PlatformPageHeader
        title='Scheduler'
        description='Monitor scheduled jobs, run maintenance tasks, and review failures.'
        breadcrumbRoot={{ label: 'Platform' }}
        actions={
          <Button onClick={controller.openCreateForm}>
            <IconPlus className='size-4' />
            New task
          </Button>
        }
      />
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4'>
        <SchedulerSummary
          enabledCount={controller.enabledCount}
          failedCount={controller.failedCount}
          totalCount={controller.tasks.length}
        />
        <ScheduledTasksTable />
      </section>
      <ScheduledTaskFormDialog />
    </ProtectedStackPageLayout>
  )
}

const SchedulerSummary = ({
  enabledCount,
  failedCount,
  totalCount
}: {
  enabledCount: number
  failedCount: number
  totalCount: number
}) => {
  const pausedCount = totalCount - enabledCount
  const items = [
    { label: 'Total tasks', value: totalCount },
    { label: 'Enabled', value: enabledCount },
    { label: 'Paused', value: pausedCount },
    { label: 'Failed', value: failedCount }
  ]

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      {items.map(item => (
        <div
          key={item.label}
          className='rounded-lg border border-border/60 bg-surface-panel/45 px-4 py-3'
        >
          <div className='text-xs font-medium text-muted-foreground'>{item.label}</div>
          <div className='mt-1 text-2xl font-semibold text-foreground'>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

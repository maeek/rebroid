'use client'

import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScheduledTaskFormDialog } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-task-form-dialog'
import {
  ScheduledTasksProvider,
  useScheduledTasksControllerContext
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { ScheduledTasksTable } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table'
import { PageHeader } from '@/shared/ui/page/page-header'
import { PageContent, StandardPage } from '@/shared/ui/page/page-layout'
import { QuickGlanceCard } from '@/shared/ui/settings/quick-glance-card'
import type { ScheduledTasksPageProps } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/types'

export function ScheduledTasksPage({ loading = false, ...props }: ScheduledTasksPageProps & { loading?: boolean }) {
  return (
    <ScheduledTasksProvider value={props}>
      <ScheduledTasksPageContent loading={loading} />
    </ScheduledTasksProvider>
  )
}

const ScheduledTasksPageContent = ({ loading }: { loading: boolean }) => {
  const controller = useScheduledTasksControllerContext()

  return (
    <StandardPage className='gap-2'>
      <PageHeader
        section={{ label: 'Platform', href: '/platform' }}
        title='Scheduler'
        description='Monitor scheduled jobs, run maintenance tasks, and review failures.'
        actions={
          <Button
            disabled={loading}
            onClick={controller.openCreateForm}
          >
            <IconPlus className='size-4' />
            New task
          </Button>
        }
      />
      <PageContent>
        <SchedulerSummary
          loading={loading}
          enabledCount={controller.enabledCount}
          failedCount={controller.failedCount}
          totalCount={controller.tasks.length}
        />
        <ScheduledTasksTable loading={loading} />
      </PageContent>
      <ScheduledTaskFormDialog />
    </StandardPage>
  )
}

const SchedulerSummary = ({
  enabledCount,
  failedCount,
  totalCount,
  loading
}: {
  enabledCount: number
  failedCount: number
  totalCount: number
  loading: boolean
}) => {
  const items = [
    { label: 'Total tasks', value: totalCount, hint: 'Built-in and custom schedules' },
    { label: 'Enabled', value: enabledCount, hint: 'Scheduled to run automatically' },
    { label: 'Paused', value: totalCount - enabledCount, hint: 'Automatic runs are paused' },
    { label: 'Failed', value: failedCount, hint: 'Tasks whose last run failed' }
  ]

  return (
    <div
      className='grid grid-cols-2 gap-3 xl:grid-cols-4'
      data-testid={loading ? 'scheduler-summary-skeleton' : undefined}
      aria-label='Scheduler summary'
      aria-busy={loading}
    >
      {items.map(item => (
        <QuickGlanceCard
          key={item.label}
          label={item.label}
          value={loading ? <Skeleton className='h-8 w-12' /> : item.value}
          hint={item.hint}
          tone={item.label === 'Failed' && failedCount > 0 ? 'danger' : 'neutral'}
        />
      ))}
    </div>
  )
}

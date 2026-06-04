'use client'

import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { PlatformPageHeader } from '@/features/orchestrator/components/platform-page-header'
import { ScheduledTaskFormDialog } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-task-form-dialog'
import {
  ScheduledTasksProvider,
  useScheduledTasksControllerContext
} from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-context'
import { ScheduledTasksTable } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-table'
import { ProtectedStackPageLayout } from '@/features/shell/components/protected-page-shell'
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
        title='Scheduled tasks'
        description='Recurring maintenance jobs with simple schedules.'
        includeOrchestratorBreadcrumb={false}
        actions={
          <Button
            className='max-sm:w-full'
            onClick={controller.openCreateForm}
          >
            <IconPlus className='size-4' />
            New task
          </Button>
        }
      />
      <section className='grid w-full gap-6 px-6 pb-16 max-sm:px-4'>
        <div className='overflow-hidden rounded-lg border border-border/70 bg-card/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md'>
          <div className='border-b border-border/60 px-5 py-4 max-sm:px-4'>
            <div className='grid gap-1'>
              <h3 className='font-medium text-foreground'>Tasks</h3>
              <p className='text-sm text-secondary-foreground'>
                {controller.enabledCount} enabled · {controller.tasks.length - controller.enabledCount} paused ·{' '}
                {controller.failedCount} failed
              </p>
            </div>
          </div>
          <ScheduledTasksTable />
        </div>
      </section>
      <ScheduledTaskFormDialog />
    </ProtectedStackPageLayout>
  )
}

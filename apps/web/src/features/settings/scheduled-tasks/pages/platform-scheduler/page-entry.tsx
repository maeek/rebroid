import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ScheduledTasksPage } from '../../scheduled-tasks-page/scheduled-tasks-page'
import { loadPlatformSchedulerPageData } from './page-data.server'

export async function PlatformSchedulerPageEntry() {
  const { actions, orchestratorError, tasks } = await loadPlatformSchedulerPageData()

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Scheduler'
        description='Monitor scheduled jobs, run maintenance tasks, and review failures.'
        href='/platform/scheduler'
        section={{ label: 'Platform' }}
      />
    )
  }

  return (
    <ScheduledTasksPage
      initialActions={actions}
      initialTasks={tasks}
    />
  )
}

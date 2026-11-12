import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ScheduledTasksPage } from '../../scheduled-tasks-page/scheduled-tasks-page'
import { loadPlatformSchedulerPageData } from './page-data.server'

export async function PlatformSchedulerPageEntry() {
  const { actions, orchestratorError, tasks } = await loadPlatformSchedulerPageData()

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Maintenance tasks'
        description='Monitor scheduled jobs, run maintenance tasks, and review failures.'
        section={{ label: 'System' }}
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

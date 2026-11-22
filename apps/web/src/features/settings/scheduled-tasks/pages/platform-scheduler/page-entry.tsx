import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ScheduledTasksPage } from '../../scheduled-tasks-page/scheduled-tasks-page'
import { loadPlatformSchedulerPageData } from './page-data.server'

export async function PlatformSchedulerPageEntry() {
  const result = await loadPlatformSchedulerPageData()

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        requestId={result.requestId}
        title='Maintenance tasks'
        description='Monitor scheduled jobs, run maintenance tasks, and review failures.'
        section={{ label: 'System' }}
      />
    )
  }

  return (
    <ScheduledTasksPage
      initialActions={result.data.actions}
      initialTasks={result.data.tasks}
    />
  )
}

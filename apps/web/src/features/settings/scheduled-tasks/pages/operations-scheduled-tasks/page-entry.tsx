import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { ScheduledTasksPage } from '../../scheduled-tasks-page/scheduled-tasks-page'
import { loadOperationsScheduledTasksPageData } from './page-data.server'

export async function OperationsScheduledTasksPageEntry() {
  const { actions, orchestratorError, tasks } = await loadOperationsScheduledTasksPageData()

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Scheduled tasks'
        description='Recurring maintenance jobs with simple schedules.'
        detail={orchestratorError}
        href='/operations/scheduled-tasks'
        breadcrumbRoot={{ label: 'Operations' }}
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

import { ScheduledTasksPage } from '../../scheduled-tasks-page/scheduled-tasks-page'
import { loadOperationsScheduledTasksPageData } from './page-data.server'

export async function OperationsScheduledTasksPageEntry() {
  const { actions, tasks } = await loadOperationsScheduledTasksPageData()

  return (
    <ScheduledTasksPage
      initialActions={actions}
      initialTasks={tasks}
    />
  )
}

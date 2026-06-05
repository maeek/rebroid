import { ScheduledTasksPage } from '@/features/settings/scheduled-tasks/scheduled-tasks-page/scheduled-tasks-page'
import { listScheduledTaskActionsAction, listScheduledTasksAction } from '@/server/orchestrator/scheduled-tasks/actions'

export default async function ScheduledTasksRoute() {
  const [actions, tasks] = await Promise.all([listScheduledTaskActionsAction(), listScheduledTasksAction()])

  return (
    <ScheduledTasksPage
      initialActions={actions}
      initialTasks={tasks}
    />
  )
}

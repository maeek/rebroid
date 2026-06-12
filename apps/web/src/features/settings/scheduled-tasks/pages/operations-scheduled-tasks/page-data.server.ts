import { listScheduledTaskActionsAction, listScheduledTasksAction } from '@/server/orchestrator/scheduled-tasks/actions'

export const loadOperationsScheduledTasksPageData = async () => {
  const [actions, tasks] = await Promise.all([listScheduledTaskActionsAction(), listScheduledTasksAction()])

  return {
    actions,
    tasks
  }
}

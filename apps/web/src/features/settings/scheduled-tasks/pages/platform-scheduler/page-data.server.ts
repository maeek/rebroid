import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorScheduledTasksClient } from '@/server/orchestrator/scheduled-tasks/client'

export const loadPlatformSchedulerPageData = async () => {
  await requireAdmin()
  return runSafeAction(
    async () => {
      const [actions, tasks] = await Promise.all([
        orchestratorScheduledTasksClient.listActions(),
        orchestratorScheduledTasksClient.list()
      ])
      return { actions, tasks }
    },
    { fallbackMessage: 'Could not load maintenance tasks.', logLabel: 'Load maintenance tasks' }
  )
}

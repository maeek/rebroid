import { listScheduledTaskActionsAction, listScheduledTasksAction } from '@/server/orchestrator/scheduled-tasks/actions'
import type { ScheduledTask, ScheduledTaskAction } from '@/shared/contracts/scheduled-task'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const loadPlatformSchedulerPageData = async () => {
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [actions, tasks] = await Promise.all([
    listScheduledTaskActionsAction().catch(error => {
      captureError(error)
      return [] as ScheduledTaskAction[]
    }),
    listScheduledTasksAction().catch(error => {
      captureError(error)
      return [] as ScheduledTask[]
    })
  ])

  return {
    actions,
    orchestratorError,
    tasks
  }
}

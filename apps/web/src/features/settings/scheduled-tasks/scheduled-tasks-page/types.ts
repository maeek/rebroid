import type { SaveScheduledTaskInput, ScheduledTask, ScheduledTaskAction } from '@/shared/contracts/scheduled-task'
import type { ScheduleDraft } from '@/shared/model/automation-schedule'

export type FormState = Omit<SaveScheduledTaskInput, 'cronExpression'> & {
  id?: string
  kind?: ScheduledTask['kind']
  predefinedKey?: string | null
  schedule: ScheduleDraft
}

export type ScheduledTasksPageProps = {
  initialActions: ScheduledTaskAction[]
  initialTasks: ScheduledTask[]
}

import type {
  SaveScheduledTaskInput,
  ScheduledTask,
  ScheduledTaskAction,
  ScheduledTaskActionType
} from '@/server/orchestrator/scheduled-tasks/types'
import type { ScheduleDraft, ScheduleFrequency } from '@rebroid/automation-core/schedule'

export type FormState = Omit<SaveScheduledTaskInput, 'cronExpression'> & {
  id?: string
  kind?: ScheduledTask['kind']
  predefinedKey?: string | null
  schedule: ScheduleDraft
}

export type { ScheduleDraft, ScheduleFrequency }

export type ScheduledTasksPageProps = {
  initialActions: ScheduledTaskAction[]
  initialTasks: ScheduledTask[]
}

export type ScheduledTasksActionMap = Map<ScheduledTaskActionType, ScheduledTaskAction>

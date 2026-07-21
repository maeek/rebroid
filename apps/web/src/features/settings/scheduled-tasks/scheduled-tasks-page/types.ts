import type {
  SaveScheduledTaskInput,
  ScheduledTask,
  ScheduledTaskAction,
  ScheduledTaskActionType
} from '@/shared/contracts/scheduled-task'
import type { ScheduleDraft, ScheduleFrequency } from '@/shared/model/automation-schedule'

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

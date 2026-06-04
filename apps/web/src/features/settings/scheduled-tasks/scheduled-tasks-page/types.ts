import type {
  SaveScheduledTaskInput,
  ScheduledTask,
  ScheduledTaskAction,
  ScheduledTaskActionType
} from '@/server/orchestrator/scheduled-tasks/types'

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly'

export type ScheduleDraft = {
  frequency: ScheduleFrequency
  intervalHours: number
  time: string
  weekday: string
  monthDay: number
}

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

export type ScheduledTasksActionMap = Map<ScheduledTaskActionType, ScheduledTaskAction>

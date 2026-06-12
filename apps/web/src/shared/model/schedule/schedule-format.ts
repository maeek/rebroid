import {
  cronToSchedule,
  defaultSchedule,
  scheduleToCron,
  type ScheduleDraft,
  weekdays
} from '@rebroid/automation-core/schedule'

export { cronToSchedule, defaultSchedule, scheduleToCron, weekdays }

export type { ScheduleDraft }

export const scheduleLabel = (cronExpression: string) => {
  const schedule = cronToSchedule(cronExpression)
  if (schedule.frequency === 'hourly') {
    return `Every ${schedule.intervalHours} ${schedule.intervalHours === 1 ? 'hour' : 'hours'}`
  }
  if (schedule.frequency === 'weekly') {
    return `Every ${weekdays.find(day => day.value === schedule.weekday)?.label ?? 'week'} at ${schedule.time}`
  }
  if (schedule.frequency === 'monthly') {
    return `Monthly on day ${schedule.monthDay} at ${schedule.time}`
  }
  return `Every day at ${schedule.time}`
}

export const dateLabel = (value: string | null) => (value ? new Date(value).toLocaleString() : '-')

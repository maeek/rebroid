import { cronToSchedule, scheduleLabel, scheduleToCron, weekdays } from '@/shared/model/schedule/schedule-format'

const scheduleParts = (expression: string) => {
  const schedule = cronToSchedule(expression)
  if (scheduleToCron(schedule) !== expression.trim().replace(/\s+/g, ' ')) {
    return { frequency: expression, time: 'Cron expression' }
  }
  if (schedule.frequency === 'hourly') {
    return { frequency: schedule.intervalHours === 1 ? 'Every hour' : scheduleLabel(expression), time: null }
  }
  if (schedule.frequency === 'weekly') {
    return {
      frequency: `Every ${weekdays.find(day => day.value === schedule.weekday)?.label ?? 'week'}`,
      time: schedule.time
    }
  }
  if (schedule.frequency === 'monthly') {
    return { frequency: `Day ${schedule.monthDay} of each month`, time: schedule.time }
  }
  return { frequency: 'Every day', time: schedule.time }
}

export const ScheduleValue = ({ expression }: { expression: string }) => {
  const { frequency, time } = scheduleParts(expression)
  return (
    <div
      className='grid gap-1'
      title={expression}
    >
      <span className='truncate'>{frequency}</span>
      {time ? <span className='text-xs tabular-nums text-foreground-muted'>{time}</span> : null}
    </div>
  )
}

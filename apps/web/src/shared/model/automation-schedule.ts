export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface ScheduleDraft {
  frequency: ScheduleFrequency
  intervalHours: number
  time: string
  weekday: string
  monthDay: number
}

export const defaultSchedule: ScheduleDraft = {
  frequency: 'daily',
  intervalHours: 24,
  time: '03:00',
  weekday: '0',
  monthDay: 1
}

export const weekdays = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
] as const

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

const timeParts = (time: string) => {
  const [hour = '3', minute = '0'] = time.split(':')
  return {
    hour: clampInteger(Number(hour), 0, 23),
    minute: clampInteger(Number(minute), 0, 59)
  }
}

export const scheduleToCron = (schedule: ScheduleDraft) => {
  const { hour, minute } = timeParts(schedule.time)
  if (schedule.frequency === 'hourly') {
    return `0 */${clampInteger(schedule.intervalHours, 1, 24)} * * *`
  }
  if (schedule.frequency === 'weekly') {
    return `${minute} ${hour} * * ${schedule.weekday}`
  }
  if (schedule.frequency === 'monthly') {
    return `${minute} ${hour} ${clampInteger(schedule.monthDay, 1, 28)} * *`
  }
  return `${minute} ${hour} * * *`
}

export const cronToSchedule = (cronExpression: string): ScheduleDraft => {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.trim().split(/\s+/)
  if (minute === '0' && hour?.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return {
      ...defaultSchedule,
      frequency: 'hourly',
      intervalHours: clampInteger(Number(hour.slice(2)), 1, 24)
    }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek && dayOfWeek !== '*') {
    return {
      ...defaultSchedule,
      frequency: 'weekly',
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      weekday: weekdays.some(day => day.value === dayOfWeek) ? dayOfWeek : '0'
    }
  }
  if (dayOfMonth && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    return {
      ...defaultSchedule,
      frequency: 'monthly',
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      monthDay: clampInteger(Number(dayOfMonth), 1, 28)
    }
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return {
      ...defaultSchedule,
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }
  return defaultSchedule
}

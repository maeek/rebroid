'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { defaultSchedule, weekdays } from '@/shared/model/schedule/schedule-format'
import type { ScheduleDraft, ScheduleFrequency } from '@rebroid/automation-core/schedule'

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

export const ScheduleEditor = ({
  schedule,
  onScheduleChange
}: {
  schedule: ScheduleDraft
  onScheduleChange: (patch: Partial<ScheduleDraft>) => void
}) => (
  <div className='grid gap-3'>
    <label className='text-sm font-medium text-foreground'>Schedule</label>
    <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'>
      <Select
        value={schedule.frequency}
        onValueChange={value => onScheduleChange({ frequency: value as ScheduleFrequency })}
      >
        <SelectTrigger className='w-full sm:w-auto sm:min-w-36 sm:shrink-0'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='hourly'>Every few hours</SelectItem>
          <SelectItem value='daily'>Every day</SelectItem>
          <SelectItem value='weekly'>Every week</SelectItem>
          <SelectItem value='monthly'>Every month</SelectItem>
        </SelectContent>
      </Select>
      <Visible when={schedule.frequency === 'hourly'}>
        <div className='flex min-w-0 items-center gap-2 sm:flex-1 sm:basis-64 sm:max-w-md'>
          <span className='text-sm text-secondary-foreground'>Every</span>
          <Input
            type='number'
            className='min-w-0 flex-1'
            min={1}
            max={24}
            value={schedule.intervalHours}
            onChange={event => onScheduleChange({ intervalHours: clampInteger(Number(event.target.value), 1, 24) })}
          />
          <span className='text-sm text-secondary-foreground'>hours</span>
        </div>
      </Visible>
      <Visible when={schedule.frequency !== 'hourly'}>
        <Input
          type='time'
          className='min-w-0 sm:flex-1 sm:basis-64 sm:max-w-md'
          value={schedule.time}
          onChange={event => onScheduleChange({ time: event.target.value || defaultSchedule.time })}
        />
      </Visible>
    </div>
    <Visible when={schedule.frequency === 'weekly'}>
      <Select
        value={schedule.weekday}
        onValueChange={weekday => onScheduleChange({ weekday })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {weekdays.map(day => (
            <SelectItem
              key={day.value}
              value={day.value}
            >
              {day.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Visible>
    <Visible when={schedule.frequency === 'monthly'}>
      <div className='flex items-center gap-2'>
        <span className='text-sm text-secondary-foreground'>Day</span>
        <Input
          type='number'
          min={1}
          max={28}
          value={schedule.monthDay}
          onChange={event => onScheduleChange({ monthDay: clampInteger(Number(event.target.value), 1, 28) })}
        />
        <span className='text-sm text-secondary-foreground'>of each month</span>
      </div>
    </Visible>
  </div>
)

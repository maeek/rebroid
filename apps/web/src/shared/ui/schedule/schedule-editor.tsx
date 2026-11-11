'use client'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Visible } from '@/components/ui/visible'
import { defaultSchedule, weekdays } from '@/shared/model/schedule/schedule-format'
import type { ScheduleDraft } from '@/shared/model/automation-schedule'

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)))

export const ScheduleEditor = ({
  schedule,
  onScheduleChange
}: {
  schedule: ScheduleDraft
  onScheduleChange: (patch: Partial<ScheduleDraft>) => void
}) => (
  <fieldset className='grid min-w-0 gap-4'>
    <legend className='mb-4 text-sm font-medium text-foreground'>Schedule</legend>
    <div className='grid min-w-0 gap-x-form-column gap-y-4 sm:grid-cols-2'>
      <FormField
        label='Frequency'
        layout='vertical'
      >
        <Select
          value={schedule.frequency}
          onValueChange={value => onScheduleChange({ frequency: value })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='hourly'>Every few hours</SelectItem>
            <SelectItem value='daily'>Every day</SelectItem>
            <SelectItem value='weekly'>Every week</SelectItem>
            <SelectItem value='monthly'>Every month</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <Visible when={schedule.frequency === 'hourly'}>
        <FormField
          label='Interval (hours)'
          layout='vertical'
        >
          <Input
            type='number'
            className='max-w-48'
            min={1}
            max={24}
            value={schedule.intervalHours}
            onChange={event => onScheduleChange({ intervalHours: clampInteger(Number(event.target.value), 1, 24) })}
          />
        </FormField>
      </Visible>
      <Visible when={schedule.frequency !== 'hourly'}>
        <FormField
          label='Time'
          layout='vertical'
        >
          <Input
            type='time'
            value={schedule.time}
            onChange={event => onScheduleChange({ time: event.target.value || defaultSchedule.time })}
          />
        </FormField>
      </Visible>
      <Visible when={schedule.frequency === 'weekly'}>
        <FormField
          label='Day of week'
          layout='vertical'
        >
          <Select
            value={schedule.weekday}
            onValueChange={weekday => onScheduleChange({ weekday })}
          >
            <SelectTrigger className='w-full'>
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
        </FormField>
      </Visible>
      <Visible when={schedule.frequency === 'monthly'}>
        <FormField
          label='Day of month'
          description='Choose a day from 1 to 28.'
          layout='vertical'
        >
          <Input
            type='number'
            className='max-w-48'
            min={1}
            max={28}
            value={schedule.monthDay}
            onChange={event => onScheduleChange({ monthDay: clampInteger(Number(event.target.value), 1, 28) })}
          />
        </FormField>
      </Visible>
    </div>
  </fieldset>
)

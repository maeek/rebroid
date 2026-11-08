import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultSchedule } from '@/shared/model/automation-schedule'
import { ScheduleEditor } from './schedule-editor'
import type { ScheduleDraft } from '@/shared/model/automation-schedule'

describe('ScheduleEditor', () => {
  it('labels every frequency-specific control and keeps interval bounds', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        schedule={{ ...defaultSchedule, frequency: 'hourly' }}
        onScheduleChange={onChange}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Frequency' })).toBeVisible()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Interval (hours)' }), { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith({ intervalHours: 24 })
  })

  it('retains time and monthly drafts across frequency changes', () => {
    function Harness() {
      const [schedule, setSchedule] = useState<ScheduleDraft>({
        ...defaultSchedule,
        frequency: 'monthly',
        monthDay: 18,
        time: '08:15'
      })
      return (
        <>
          <button
            onClick={() =>
              setSchedule(value => ({ ...value, frequency: value.frequency === 'weekly' ? 'monthly' : 'weekly' }))
            }
          >
            Change frequency
          </button>
          <ScheduleEditor
            schedule={schedule}
            onScheduleChange={patch => setSchedule(value => ({ ...value, ...patch }))}
          />
        </>
      )
    }
    render(<Harness />)
    expect(screen.getByLabelText('Time')).toHaveValue('08:15')
    expect(screen.getByRole('spinbutton', { name: 'Day of month' })).toHaveValue(18)
    fireEvent.click(screen.getByRole('button', { name: 'Change frequency' }))
    expect(screen.getByRole('combobox', { name: 'Day of week' })).toBeVisible()
    expect(screen.queryByRole('spinbutton', { name: 'Day of month' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Change frequency' }))
    expect(screen.getByRole('spinbutton', { name: 'Day of month' })).toHaveValue(18)
    expect(screen.getByLabelText('Time')).toHaveValue('08:15')
  })
})

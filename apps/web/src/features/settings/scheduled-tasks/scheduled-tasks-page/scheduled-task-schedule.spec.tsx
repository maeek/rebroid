import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScheduleValue } from '@/shared/ui/schedule/schedule-value'

describe('ScheduleValue', () => {
  it.each([
    ['0 */1 * * *', 'Every hour', null],
    ['0 */6 * * *', 'Every 6 hours', null],
    ['15 9 * * 2', 'Every Tuesday', '09:15'],
    ['5 1 28 * *', 'Day 28 of each month', '01:05'],
    ['30 3 * * *', 'Every day', '03:30']
  ] as const)('displays the frequency and time for %s', (expression, frequency, time) => {
    render(<ScheduleValue expression={expression} />)
    expect(screen.getByText(frequency)).toBeVisible()
    if (time) expect(screen.getByText(time)).toBeVisible()
  })

  it('preserves cron expressions that cannot be represented by the simple schedule editor', () => {
    render(<ScheduleValue expression='15 3,9 * * 1-5' />)

    expect(screen.getByText('15 3,9 * * 1-5')).toBeVisible()
    expect(screen.getByText('Cron expression')).toBeVisible()
    expect(screen.queryByText('Every day')).toBeNull()
  })
})

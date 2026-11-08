import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScheduleValue } from '@/shared/ui/schedule/schedule-value'

describe('ScheduleValue', () => {
  it('preserves cron expressions that cannot be represented by the simple schedule editor', () => {
    render(<ScheduleValue expression='15 3,9 * * 1-5' />)

    expect(screen.getByText('15 3,9 * * 1-5')).toBeVisible()
    expect(screen.getByText('Cron expression')).toBeVisible()
    expect(screen.queryByText('Every day')).toBeNull()
  })
})

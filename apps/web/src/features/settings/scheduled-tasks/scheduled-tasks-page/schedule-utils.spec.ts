import { describe, expect, it } from 'vitest'
import { cronToSchedule, scheduleLabel, scheduleToCron } from './schedule-utils'

describe('scheduled task schedule utilities', () => {
  it('converts schedule drafts to cron expressions', () => {
    expect(scheduleToCron({ frequency: 'hourly', intervalHours: 6, time: '03:00', weekday: '0', monthDay: 1 })).toBe(
      '0 */6 * * *'
    )
    expect(scheduleToCron({ frequency: 'weekly', intervalHours: 24, time: '09:15', weekday: '2', monthDay: 1 })).toBe(
      '15 9 * * 2'
    )
    expect(scheduleToCron({ frequency: 'monthly', intervalHours: 24, time: '01:05', weekday: '0', monthDay: 31 })).toBe(
      '5 1 28 * *'
    )
  })

  it('parses known cron expressions back into schedule drafts', () => {
    expect(cronToSchedule('0 */12 * * *')).toMatchObject({ frequency: 'hourly', intervalHours: 12 })
    expect(cronToSchedule('15 9 * * 2')).toMatchObject({ frequency: 'weekly', time: '09:15', weekday: '2' })
    expect(cronToSchedule('5 1 28 * *')).toMatchObject({ frequency: 'monthly', time: '01:05', monthDay: 28 })
  })

  it('formats readable schedule labels', () => {
    expect(scheduleLabel('0 */1 * * *')).toBe('Every 1 hour')
    expect(scheduleLabel('15 9 * * 2')).toBe('Every Tuesday at 09:15')
    expect(scheduleLabel('5 1 28 * *')).toBe('Monthly on day 28 at 01:05')
  })
})

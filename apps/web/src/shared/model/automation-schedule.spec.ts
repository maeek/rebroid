import { describe, expect, it } from 'vitest'
import { cronToSchedule, defaultSchedule, scheduleToCron } from './automation-schedule'

describe('automation schedule conversion', () => {
  it.each([
    [{ ...defaultSchedule, frequency: 'hourly' as const, intervalHours: 6 }, '0 */6 * * *'],
    [{ ...defaultSchedule, frequency: 'daily' as const, time: '09:30' }, '30 9 * * *'],
    [{ ...defaultSchedule, frequency: 'weekly' as const, time: '08:15', weekday: '2' }, '15 8 * * 2'],
    [{ ...defaultSchedule, frequency: 'monthly' as const, time: '07:05', monthDay: 12 }, '5 7 12 * *']
  ])('serializes %o', (schedule, cron) => {
    expect(scheduleToCron(schedule)).toBe(cron)
  })

  it('parses supported cron shapes and falls back for unrelated expressions', () => {
    expect(cronToSchedule('0 */4 * * *')).toMatchObject({
      frequency: 'hourly',
      intervalHours: 4
    })
    expect(cronToSchedule('45 14 * * 5')).toMatchObject({
      frequency: 'weekly',
      time: '14:45',
      weekday: '5'
    })
    expect(cronToSchedule('10 6 21 * *')).toMatchObject({
      frequency: 'monthly',
      time: '06:10',
      monthDay: 21
    })
    expect(cronToSchedule('invalid')).toEqual(defaultSchedule)
  })

  it('bounds user-editable numeric fields', () => {
    expect(
      scheduleToCron({
        ...defaultSchedule,
        frequency: 'hourly',
        intervalHours: 99
      })
    ).toBe('0 */24 * * *')
    expect(
      scheduleToCron({
        ...defaultSchedule,
        frequency: 'monthly',
        monthDay: 31,
        time: '25:70'
      })
    ).toBe('59 23 28 * *')
  })
})

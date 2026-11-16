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

  it('parses supported cron shapes', () => {
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
  })

  it.each(['15 9 * * MON-FRI', '0 5 31 * *', '30 15 9 * * 1', '*/10 0-4 * * *', '0 */0 * * *'])(
    'retains expressions the schedule controls cannot represent (%s)',
    expression => {
      const schedule = cronToSchedule(expression)
      expect(schedule.frequency).toBe('custom')
      expect(scheduleToCron(schedule)).toBe(expression)
    }
  )

  it('keeps the original spelling of a supported expression until edited', () => {
    const expression = '05 09 * * 02'
    const schedule = cronToSchedule(expression)
    expect(schedule).toMatchObject({ frequency: 'weekly', time: '09:05', weekday: '2' })
    expect(scheduleToCron(schedule)).toBe(expression)
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

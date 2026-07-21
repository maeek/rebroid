import { BadRequestException } from '@nestjs/common';
import { nextCronRun, normalizeCronExpression } from './cron-schedule';

describe('cron schedule helpers', () => {
  it.each([
    ['0 3 * * *', '0 3 * * *'],
    ['  */15 * * * *  ', '*/15 * * * *'],
    ['0 0 1 1 *', '0 0 1 1 *'],
  ])('normalizes valid cron expressions', (input, expected) => {
    expect(normalizeCronExpression(input)).toBe(expected);
  });

  it.each(['', 'not cron', '61 * * * *'])(
    'rejects invalid cron expressions',
    (input) => {
      expect(() => normalizeCronExpression(input)).toThrow(BadRequestException);
    },
  );

  it('returns the next run as a Date', () => {
    expect(nextCronRun('0 3 * * *')).toBeInstanceOf(Date);
  });
});

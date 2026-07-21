import { BadRequestException } from '@nestjs/common';
import { sendAt, validateCronExpression } from 'cron';
import { getErrorMessage } from './error-message';

export const normalizeCronExpression = (value: string) => {
  const cronExpression = value.trim();
  const result = validateCronExpression(cronExpression);
  if (!result.valid) {
    throw new BadRequestException(
      result.error?.message ?? 'Invalid cron expression.',
    );
  }
  return cronExpression;
};

export const nextCronRun = (cronExpression: string) => {
  try {
    return sendAt(cronExpression).toJSDate();
  } catch (error) {
    throw new BadRequestException(getErrorMessage(error));
  }
};

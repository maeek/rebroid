import { BadRequestException, Injectable } from '@nestjs/common';
import { sendAt, validateCronExpression } from 'cron';
import { getErrorMessage } from '../../common/error-message';

@Injectable()
export class AutomationScheduleService {
  validateCronExpression(value: string) {
    const cronExpression = value.trim();
    const result = validateCronExpression(cronExpression);
    if (!result.valid) {
      throw new BadRequestException(
        result.error?.message ?? 'Invalid cron expression.',
      );
    }
    return cronExpression;
  }

  nextRun(cronExpression: string) {
    try {
      return sendAt(cronExpression).toJSDate();
    } catch (error) {
      throw new BadRequestException(getErrorMessage(error));
    }
  }
}

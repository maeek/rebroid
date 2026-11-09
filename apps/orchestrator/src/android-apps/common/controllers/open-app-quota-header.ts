import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

const headerName = 'x-rebroid-max-open-apps';

export const ApiOpenAppQuota = () =>
  ApiHeader({
    name: headerName,
    required: false,
    description: 'Open application limit supplied by the trusted web service.',
    schema: { type: 'integer', minimum: 0 },
  });

export const OpenAppQuota = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | undefined => {
    const value = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
    }>().headers[headerName];
    if (value === undefined) return undefined;
    if (
      typeof value !== 'string' ||
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    ) {
      throw new BadRequestException('Invalid open application limit.');
    }
    return Number(value);
  },
);

import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';
import { androidApplicationResourceLimits } from '@rebroid/android-application-core/redroid-runtime';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function optionalNumber(
  { min, max }: { min: number; max: number },
  validator: PropertyDecorator,
  options: ApiPropertyOptions,
) {
  return applyDecorators(
    Max(max),
    Min(min),
    validator,
    Type(() => Number),
    IsOptional(),
    ApiPropertyOptional({
      type: Number,
      minimum: min,
      maximum: max,
      ...options,
    }),
  );
}

export const InactivityTimeout = (options: { default?: number } = {}) =>
  optionalNumber({ min: -1, max: 86400 }, IsInt(), {
    description: 'Use -1 to keep the session running until manually stopped.',
    ...options,
  });

export const MemoryLimit = (options: { nullable?: true } = {}) =>
  optionalNumber(androidApplicationResourceLimits.memoryLimitMb, IsInt(), {
    example: 2048,
    ...options,
  });

export const CpuLimit = (options: { nullable?: true } = {}) =>
  optionalNumber(androidApplicationResourceLimits.cpuLimitCpus, IsNumber(), {
    example: 2,
    ...options,
  });

export const ContainerArgs = (options: { nullable?: true } = {}) =>
  applyDecorators(
    MaxLength(2048),
    IsString(),
    IsOptional(),
    ApiPropertyOptional({
      type: String,
      description:
        'Optional command or arguments passed to the container as Docker Cmd. Use a long-running command if the image would otherwise exit immediately.',
      example: 'sleep infinity',
      ...options,
    }),
  );

import { androidApplicationResourceLimits } from '@rebroid/android-application-core/redroid-runtime';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const { memoryLimitMb, cpuLimitCpus } = androidApplicationResourceLimits;

export class UpdateAndroidApplicationDto {
  @ApiPropertyOptional({ example: 'Signal Android' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: -1,
    maximum: 86400,
    description: 'Use -1 to keep the session running until manually stopped.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(86400)
  inactivityTimeoutSeconds?: number;

  @ApiPropertyOptional({
    type: Number,
    example: 2048,
    minimum: memoryLimitMb.min,
    maximum: memoryLimitMb.max,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(memoryLimitMb.min)
  @Max(memoryLimitMb.max)
  memoryLimitMb?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 2,
    minimum: cpuLimitCpus.min,
    maximum: cpuLimitCpus.max,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(cpuLimitCpus.min)
  @Max(cpuLimitCpus.max)
  cpuLimitCpus?: number | null;

  @ApiPropertyOptional({
    type: String,
    description:
      'Optional command or arguments passed to the container as Docker Cmd. Use a long-running command if the image would otherwise exit immediately.',
    example: 'sleep infinity',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  containerArgs?: string | null;
}

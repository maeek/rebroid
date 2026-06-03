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
    minimum: 128,
    maximum: 262144,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(262144)
  memoryLimitMb?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 2,
    minimum: 0.1,
    maximum: 128,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(128)
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

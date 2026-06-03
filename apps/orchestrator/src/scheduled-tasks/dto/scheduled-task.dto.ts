import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';

export class ScheduledTaskPayloadDto {
  @ApiPropertyOptional({
    description: 'Only for prune_images. Defaults to true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  danglingOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Only for clean_runtime_logs. Logs older than this many days are removed.',
    example: 30,
    minimum: 1,
    maximum: 3650,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;
}

export class CreateScheduledTaskDto {
  @ApiProperty({ example: 'Weekly Docker cleanup' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ example: '0 3 * * 0' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  cronExpression!: string;

  @ApiProperty({ enum: ScheduledTaskActionType })
  @IsEnum(ScheduledTaskActionType)
  actionType!: ScheduledTaskActionType;

  @ApiPropertyOptional({ type: ScheduledTaskPayloadDto, nullable: true })
  @IsOptional()
  @IsObject()
  payload?: ScheduledTaskPayloadDto | null;
}

export class UpdateScheduledTaskDto extends PartialType(
  CreateScheduledTaskDto,
) {}

export class ScheduledTaskDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ enum: ScheduledTaskKind })
  kind!: ScheduledTaskKind;

  @ApiProperty({ type: String, nullable: true })
  predefinedKey!: string | null;

  @ApiProperty()
  cronExpression!: string;

  @ApiProperty({ enum: ScheduledTaskActionType })
  actionType!: ScheduledTaskActionType;

  @ApiProperty({ type: Object, nullable: true })
  payload!: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true })
  lastRunAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nextRunAt!: string | null;

  @ApiProperty({ enum: ScheduledTaskLastStatus })
  lastStatus!: ScheduledTaskLastStatus;

  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ScheduledTaskActionDto {
  @ApiProperty({ enum: ScheduledTaskActionType })
  type!: ScheduledTaskActionType;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  description!: string;
}

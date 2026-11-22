import { AutomationRunEventDto } from './automation-run-event.dto';
import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import {
  AutomationOwnerDto,
  AutomationRunTargetDto,
} from './automation-request-target.dto';

export class RunAutomationDto extends AutomationRunTargetDto {
  @ApiPropertyOptional({
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetApplicationId?: string | null;
}

export class ListAutomationRunsQueryDto extends AutomationOwnerDto {
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListActiveAutomationRunsQueryDto extends AutomationOwnerDto {}

export class ActiveAutomationRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  automationId!: string;

  @ApiProperty()
  targetApplicationId!: string;

  @ApiProperty({
    enum: [AutomationRunStatus.Queued, AutomationRunStatus.Running],
  })
  status!: AutomationRunStatus.Queued | AutomationRunStatus.Running;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  workflowName!: string | null;
}

export class AutomationStepResultDto {
  @ApiProperty({ example: 'wake-device' })
  stepId!: string;

  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentStepId?: string | null;

  @ApiPropertyOptional({ example: 'steps[0].then[0]' })
  path?: string;

  @ApiProperty({ enum: ['success', 'failed', 'skipped'] })
  status!: 'success' | 'failed' | 'skipped';

  @ApiProperty()
  startedAt!: string;

  @ApiProperty()
  completedAt!: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  output!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  error!: string | null;
}

export class AutomationRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  automationId!: string;

  @ApiProperty({ type: String, nullable: true })
  automationTriggerId!: string | null;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  targetApplicationId!: string;

  @ApiProperty({ type: String, nullable: true })
  targetProfileMode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  targetProfileName!: string | null;

  @ApiProperty({ enum: AutomationRunTrigger })
  trigger!: AutomationRunTrigger;

  @ApiProperty({ enum: AutomationRunStatus })
  status!: AutomationRunStatus;

  @ApiProperty({ type: String, nullable: true })
  startedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  completedAt!: string | null;

  @ApiProperty({ type: AutomationStepResultDto, isArray: true })
  stepResults!: AutomationStepResultDto[];

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Request ID recorded for a failed service request.',
  })
  failureRequestId?: string;

  @ApiPropertyOptional({ description: 'Code recorded for a failed run.' })
  failureCode?: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AutomationRunHistoryRowDto extends PickType(AutomationRunDto, [
  'id',
  'automationId',
  'targetApplicationId',
  'targetProfileMode',
  'targetProfileName',
  'trigger',
  'status',
  'startedAt',
  'completedAt',
  'createdAt',
  'error',
] as const) {
  @ApiProperty()
  stepCount!: number;

  @ApiProperty()
  completedSteps!: number;

  @ApiProperty()
  failedSteps!: number;
}

export class AutomationAiRunHistoryDto {
  @ApiProperty({ type: AutomationRunDto })
  run!: AutomationRunDto;

  @ApiProperty({ type: AutomationRunEventDto, isArray: true })
  events!: AutomationRunEventDto[];
}

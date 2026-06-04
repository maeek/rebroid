import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';

export class AutomationDefinitionStepDto {
  @ApiProperty({ example: 'wake-device' })
  id!: string;

  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

  @ApiProperty({ type: Object, example: { command: 'wake' } })
  with!: Record<string, unknown>;
}

export class AutomationDefinitionMetadataDto {
  @ApiProperty({ example: 'Prepare app environment' })
  name!: string;

  @ApiPropertyOptional({ example: 'Optional notes' })
  description?: string;

  @ApiPropertyOptional({ type: Object, example: { category: 'setup' } })
  labels?: Record<string, string>;
}

export class AutomationDefinitionSpecDto {
  @ApiProperty({ type: AutomationDefinitionStepDto, isArray: true })
  steps!: AutomationDefinitionStepDto[];
}

export class AutomationDefinitionDto {
  @ApiProperty({ example: 'rebroid.io/automation/v1' })
  apiVersion!: string;

  @ApiProperty({ example: 'AndroidAutomation' })
  kind!: string;

  @ApiProperty({ type: AutomationDefinitionMetadataDto })
  metadata!: AutomationDefinitionMetadataDto;

  @ApiProperty({ type: AutomationDefinitionSpecDto })
  spec!: AutomationDefinitionSpecDto;
}

export class CreateAutomationDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiPropertyOptional({
    description:
      'YAML automation definition. Required unless definition is supplied.',
  })
  @IsOptional()
  @IsString()
  yaml?: string;

  @ApiPropertyOptional({ type: AutomationDefinitionDto })
  @IsOptional()
  @IsObject()
  definition?: AutomationDefinitionDto;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  scheduleEnabled?: boolean;

  @ApiPropertyOptional({ example: '0 9 * * *', nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  cronExpression?: string | null;

  @ApiPropertyOptional({
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetApplicationId?: string | null;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}

export class ValidateAutomationYamlDto {
  @ApiProperty({ example: 'apiVersion: rebroid.io/automation/v1\n...' })
  @IsString()
  yaml!: string;
}

export class RunAutomationDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiPropertyOptional({
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetApplicationId?: string | null;
}

export class ListAutomationRunsQueryDto {
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AutomationStepResultDto {
  @ApiProperty({ example: 'wake-device' })
  stepId!: string;

  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

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

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  targetApplicationId!: string;

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

  @ApiProperty()
  updatedAt!: string;
}

export class AutomationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: AutomationDefinitionDto })
  definition!: AutomationDefinitionDto;

  @ApiProperty()
  yaml!: string;

  @ApiProperty()
  scheduleEnabled!: boolean;

  @ApiProperty({ type: String, nullable: true })
  cronExpression!: string | null;

  @ApiProperty({ type: String, nullable: true })
  targetApplicationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastRunAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nextRunAt!: string | null;

  @ApiProperty({ enum: AutomationLastStatus })
  lastStatus!: AutomationLastStatus;

  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AutomationValidationDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: AutomationDefinitionDto, nullable: true })
  definition!: AutomationDefinitionDto | null;

  @ApiProperty({ example: '', nullable: true })
  yaml!: string | null;

  @ApiProperty({ type: String, isArray: true })
  errors!: string[];
}

export class AutomationCommandDto {
  @ApiProperty({ example: 'android.viewerCommand' })
  uses!: string;

  @ApiProperty({ example: 'Viewer command' })
  label!: string;

  @ApiProperty({ example: 'Sends a supported viewer control command.' })
  description!: string;

  @ApiProperty({ type: String, isArray: true })
  requiredPermissions!: string[];
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import {
  AutomationStartPolicy,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';

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

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['smoke', 'login'],
  })
  tags?: string[];
}

export class AutomationDefinitionSpecDto {
  @ApiProperty({ type: Object, isArray: true })
  steps!: unknown[];
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

  @ApiPropertyOptional({ enum: ApplicationProfileMode })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode | null;

  @ApiPropertyOptional({ example: 'default', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  profileName?: string | null;

  @ApiPropertyOptional({
    enum: AutomationStartPolicy,
    default: AutomationStartPolicy.RequireRunning,
  })
  @IsOptional()
  @IsEnum(AutomationStartPolicy)
  startPolicy?: AutomationStartPolicy;
}

export class ListAutomationRunsQueryDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['active'] })
  @IsOptional()
  @IsString()
  status?: 'active';
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

  @ApiProperty({ type: String, isArray: true })
  tags!: string[];

  @ApiProperty({ type: AutomationDefinitionDto })
  definition!: AutomationDefinitionDto;

  @ApiProperty()
  yaml!: string;

  @ApiProperty({ type: String, nullable: true })
  lastRunAt!: string | null;

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

  @ApiProperty({ type: Object })
  inputSchema!: Record<string, unknown>;
}

export class AutomationScheduleTriggerConfigDto {
  @ApiProperty({ example: '0 9 * * *' })
  @IsString()
  @MinLength(5)
  @MaxLength(120)
  cronExpression!: string;

  @ApiPropertyOptional({
    enum: AutomationStartPolicy,
    default: AutomationStartPolicy.StartIfNeeded,
  })
  @IsOptional()
  @IsEnum(AutomationStartPolicy)
  startPolicy?: AutomationStartPolicy;
}

export class CreateAutomationTriggerDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiProperty({ example: 'Daily setup' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  automationId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  targetApplicationId!: string;

  @ApiPropertyOptional({ enum: ApplicationProfileMode })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode | null;

  @ApiPropertyOptional({ example: 'default', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  profileName?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ enum: AutomationTriggerType })
  @IsEnum(AutomationTriggerType)
  triggerType!: AutomationTriggerType;

  @ApiProperty({ type: AutomationScheduleTriggerConfigDto })
  @IsObject()
  triggerConfig!: Record<string, unknown>;
}

export class UpdateAutomationTriggerDto extends PartialType(
  CreateAutomationTriggerDto,
) {}

export class AutomationTriggerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  automationId!: string;

  @ApiProperty()
  targetApplicationId!: string;

  @ApiProperty({ type: String, nullable: true })
  profileMode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  profileName!: string | null;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: String, isArray: true })
  tags!: string[];

  @ApiProperty({ enum: AutomationTriggerType })
  triggerType!: AutomationTriggerType;

  @ApiProperty({ type: Object })
  triggerConfig!: Record<string, unknown>;

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

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
import type {
  AutomationCommandEditorMetadata,
  AutomationCommandOutputMetadata,
} from '../commands/automation-command.types';

export class AutomationTagDto {
  @ApiProperty({ example: 'smoke' })
  name!: string;

  @ApiProperty({ example: '#0ea5e9' })
  color!: string;
}

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
    type: AutomationTagDto,
    isArray: true,
    example: [
      { name: 'smoke', color: '#0ea5e9' },
      { name: 'login', color: '#22c55e' },
    ],
  })
  tags?: AutomationTagDto[];
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

export class DraftAutomationYamlDto {
  @ApiProperty({
    example: 'Log in to the app and verify the home screen opens.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  prompt!: string;

  @ApiPropertyOptional({ example: 'local-ollama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerId?: string;

  @ApiPropertyOptional({ example: 'qwen2.5vl:7b' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelId?: string;

  @ApiPropertyOptional({ example: 'local-ollama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  visionProviderId?: string;

  @ApiPropertyOptional({ example: 'qwen2.5vl:7b' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visionModelId?: string;
}

export class RunAdHocAiConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Open settings.' })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string;
}

export class RunAdHocAiAutomationDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiProperty({
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
    nullable: true,
  })
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

  @ApiPropertyOptional({
    enum: AutomationStartPolicy,
    default: AutomationStartPolicy.RequireRunning,
  })
  @IsOptional()
  @IsEnum(AutomationStartPolicy)
  startPolicy?: AutomationStartPolicy;

  @ApiProperty({ example: 'Open settings and verify Wi-Fi is visible.' })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  prompt!: string;

  @ApiPropertyOptional({
    type: RunAdHocAiConversationMessageDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  conversation?: RunAdHocAiConversationMessageDto[];

  @ApiPropertyOptional({ example: 'local-ollama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerId?: string;

  @ApiPropertyOptional({ example: 'qwen2.5vl:7b' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelId?: string;

  @ApiPropertyOptional({ example: 'local-ollama' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  visionProviderId?: string;

  @ApiPropertyOptional({ example: 'qwen2.5vl:7b' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  visionModelId?: string;

  @ApiPropertyOptional({ example: 'msg_01HV4Y6N2R2N4SVJ8VJ7HJZJAA' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  allowedTools?: string[];

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxToolCalls?: number;

  @ApiPropertyOptional({ default: 120000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(360_0000)
  timeoutMs?: number;
}

export class AutomationRunEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  runId!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  sequence!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  stepId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  parentStepId!: string | null;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: Object })
  data!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class AutomationRunEventStreamTokenDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresAt!: string;
}

export class AutomationYamlDraftDto {
  @ApiProperty()
  yaml!: string;

  @ApiProperty({ type: AutomationDefinitionDto })
  definition!: AutomationDefinitionDto;
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

export class ListAutomationsGridQueryDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ example: 'login smoke' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ example: 'smoke' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  tag?: string;

  @ApiPropertyOptional({ example: 'app-123' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetApplicationId?: string;

  @ApiPropertyOptional({ enum: AutomationLastStatus })
  @IsOptional()
  @IsEnum(AutomationLastStatus)
  status?: AutomationLastStatus;

  @ApiPropertyOptional({ enum: ['all', 'never', '7d', '30d', '90d'] })
  @IsOptional()
  @IsIn(['all', 'never', '7d', '30d', '90d'])
  lastRun?: 'all' | 'never' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ example: 'updatedAt:desc,name:asc' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: string;
}

export class ListAutomationTriggersGridQueryDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ example: 'daily smoke' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ example: 'smoke' })
  @IsOptional()
  @IsString()
  @MaxLength(48)
  tag?: string;

  @ApiPropertyOptional({ example: 'app-123' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetApplicationId?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  enabled?: 'true' | 'false';

  @ApiPropertyOptional({ enum: AutomationLastStatus })
  @IsOptional()
  @IsEnum(AutomationLastStatus)
  status?: AutomationLastStatus;

  @ApiPropertyOptional({ enum: ['all', 'never', '7d', '30d', '90d'] })
  @IsOptional()
  @IsIn(['all', 'never', '7d', '30d', '90d'])
  lastRun?: 'all' | 'never' | '7d' | '30d' | '90d';

  @ApiPropertyOptional({ example: 'updatedAt:desc,name:asc' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: string;
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

  @ApiProperty({ type: AutomationTagDto, isArray: true })
  tags!: AutomationTagDto[];

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

export class AutomationsGridFacetsDto {
  @ApiProperty({ type: String, isArray: true })
  tags!: string[];

  @ApiProperty({ type: String, isArray: true })
  targetApplicationIds!: string[];
}

export class AutomationsGridPageDto {
  @ApiProperty({ type: AutomationDto, isArray: true })
  items!: AutomationDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty({ type: AutomationsGridFacetsDto })
  facets!: AutomationsGridFacetsDto;
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

  @ApiProperty({ type: Object, isArray: true })
  outputs!: AutomationCommandOutputMetadata[];

  @ApiProperty({ type: Object })
  editor!: AutomationCommandEditorMetadata;
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

  @ApiPropertyOptional({ type: AutomationTagDto, isArray: true })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  tags?: AutomationTagDto[];

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

  @ApiProperty({ type: AutomationTagDto, isArray: true })
  tags!: AutomationTagDto[];

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

export class AutomationTriggersGridFacetsDto {
  @ApiProperty({ type: String, isArray: true })
  tags!: string[];

  @ApiProperty({ type: String, isArray: true })
  targetApplicationIds!: string[];
}

export class AutomationTriggersGridPageDto {
  @ApiProperty({ type: AutomationTriggerDto, isArray: true })
  items!: AutomationTriggerDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty({ type: AutomationTriggersGridFacetsDto })
  facets!: AutomationTriggersGridFacetsDto;
}

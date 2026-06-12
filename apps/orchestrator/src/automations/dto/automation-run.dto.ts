import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../android-apps/application-profile-mode';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationStartPolicy } from '../entities/automation-trigger.entity';

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

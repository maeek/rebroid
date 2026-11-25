import { AUTOMATION_AI_RUN_MAX_TIMEOUT_MS } from '@rebroid/automation-core/ai-run';
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AutomationRunTargetDto } from './automation-request-target.dto';

import { AutomationAiModelSelectionDto } from './automation-ai-model-selection.dto';

class RunAdHocAiConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Open settings.' })
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string;
}

export class RunAdHocAiAutomationDto extends IntersectionType(
  AutomationRunTargetDto,
  AutomationAiModelSelectionDto,
) {
  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  @IsString()
  @MaxLength(120)
  targetDeviceId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  attachmentId?: string;

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
  capabilities?: string[];

  @ApiPropertyOptional({
    enum: ['adaptive', 'controller', 'planned'],
    default: 'adaptive',
  })
  @IsOptional()
  @IsIn(['adaptive', 'controller', 'planned'])
  agentMode?: 'adaptive' | 'controller' | 'planned';

  @ApiPropertyOptional({ enum: ['deny', 'allowlisted'], default: 'deny' })
  @IsOptional()
  @IsIn(['deny', 'allowlisted'])
  rawShellPolicy?: 'deny' | 'allowlisted';

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxActions?: number;

  @ApiPropertyOptional({
    default: 120000,
    maximum: AUTOMATION_AI_RUN_MAX_TIMEOUT_MS,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(AUTOMATION_AI_RUN_MAX_TIMEOUT_MS)
  timeoutMs?: number;
}

class AiPromptSuggestionContextEventDto {
  @ApiProperty({ example: 'ai.plan.proposed' })
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiProperty({ example: 'Current screen: Home screen.' })
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class SuggestAdHocAiPromptsDto extends PickType(
  RunAdHocAiAutomationDto,
  [
    'ownerUserId',
    'targetDeviceId',
    'attachmentId',
    'profileMode',
    'profileName',
    'providerId',
    'modelId',
  ] as const,
) {
  @ApiProperty({ example: 'Android 14' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  appName!: string;

  @ApiPropertyOptional({ example: 'Turn on dark mode' })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  currentPrompt?: string;

  @ApiPropertyOptional({
    type: RunAdHocAiConversationMessageDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunAdHocAiConversationMessageDto)
  conversation?: RunAdHocAiConversationMessageDto[];

  @ApiPropertyOptional({
    type: AiPromptSuggestionContextEventDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiPromptSuggestionContextEventDto)
  recentEvents?: AiPromptSuggestionContextEventDto[];

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  allowedTools?: string[];
}

export class AiPromptSuggestionDto {
  @ApiProperty({ example: 'open-settings' })
  id!: string;

  @ApiProperty({ example: 'Open settings' })
  label!: string;

  @ApiProperty({
    example: 'Open Android Settings and inspect display options.',
  })
  prompt!: string;
}

export class AiPromptSuggestionsDto {
  @ApiProperty({ type: AiPromptSuggestionDto, isArray: true })
  suggestions!: AiPromptSuggestionDto[];
}

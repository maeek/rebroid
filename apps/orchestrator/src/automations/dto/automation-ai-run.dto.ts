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
  ValidateNested,
} from 'class-validator';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
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

  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
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
  maxToolCalls?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxActions?: number;

  @ApiPropertyOptional({ default: 120000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(360_0000)
  timeoutMs?: number;
}

export class AiPromptSuggestionContextEventDto {
  @ApiProperty({ example: 'ai.plan.proposed' })
  @IsString()
  @MaxLength(120)
  type!: string;

  @ApiProperty({ example: 'Current screen: Home screen.' })
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class SuggestAdHocAiPromptsDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;

  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  @IsString()
  @MaxLength(120)
  targetApplicationId!: string;

  @ApiProperty({ example: 'Android 14' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  appName!: string;

  @ApiPropertyOptional({ enum: ApplicationProfileMode })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode | null;

  @ApiPropertyOptional({ example: 'default', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  profileName?: string | null;

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

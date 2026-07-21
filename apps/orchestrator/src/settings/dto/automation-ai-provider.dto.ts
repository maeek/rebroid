import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AutomationAiProviderModelSettingsDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  temperature?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  topP?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  topK?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  numCtx?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  repeatPenalty?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  seed?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  keepAlive?: string | null;

  @ApiPropertyOptional({
    enum: ['disabled', 'bounded', 'provider-default'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['disabled', 'bounded', 'provider-default'])
  thinkingMode?: 'disabled' | 'bounded' | 'provider-default' | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  reasoningBudgetTokens?: number | null;
}

export class AutomationAiProviderModelCapabilitiesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  streaming?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  structuredOutput?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tools?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vision?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reasoning?: boolean;
}

export class AutomationAiProviderModelDto {
  @ApiProperty({ example: 'qwen2.5vl:7b' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  id!: string;

  @ApiProperty({ example: 'Qwen 2.5 VL 7B' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @ApiPropertyOptional({
    enum: ['controller', 'planner', 'vision'],
    isArray: true,
    default: ['planner'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['controller', 'planner', 'vision'], { each: true })
  roles!: Array<'controller' | 'planner' | 'vision'>;

  @ApiProperty({ type: AutomationAiProviderModelSettingsDto })
  @ValidateNested()
  @Type(() => AutomationAiProviderModelSettingsDto)
  settings!: AutomationAiProviderModelSettingsDto;

  @ApiPropertyOptional({ type: AutomationAiProviderModelCapabilitiesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AutomationAiProviderModelCapabilitiesDto)
  capabilities?: AutomationAiProviderModelCapabilitiesDto;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    enum: ['controller', 'planner', 'vision'],
    isArray: true,
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsIn(['controller', 'planner', 'vision'], { each: true })
  defaultFor!: Array<'controller' | 'planner' | 'vision'>;
}

export class AutomationAiProviderDto {
  @ApiProperty({ example: 'local-ollama' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  id!: string;

  @ApiProperty({ example: 'Local Ollama' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: ['openai', 'openai-compatible', 'ollama'] })
  @IsIn(['openai', 'openai-compatible', 'ollama'])
  kind!: 'openai' | 'openai-compatible' | 'ollama';

  @ApiPropertyOptional({
    enum: ['openai-chat-completions', 'ollama-native-chat'],
    default: 'openai-chat-completions',
  })
  @IsOptional()
  @IsIn(['openai-chat-completions', 'ollama-native-chat'])
  protocol?: 'openai-chat-completions' | 'ollama-native-chat';

  @ApiPropertyOptional({
    enum: ['auto', 'openai', 'llama-cpp', 'lemonade', 'ollama'],
    default: 'auto',
  })
  @IsOptional()
  @IsIn(['auto', 'openai', 'llama-cpp', 'lemonade', 'ollama'])
  serverFlavor?: 'auto' | 'openai' | 'llama-cpp' | 'lemonade' | 'ollama';

  @ApiProperty({ example: 'http://localhost:11434' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  baseUrl!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Masked on reads. Send a new value to replace the stored secret, or null to clear it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  apiKey?: string | null;

  @ApiProperty({ type: AutomationAiProviderModelDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationAiProviderModelDto)
  models!: AutomationAiProviderModelDto[];

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;
}

export class CreateAutomationAiProviderDto extends AutomationAiProviderDto {}

export class UpdateAutomationAiProviderDto extends PartialType(
  AutomationAiProviderDto,
) {}

export class CreateAutomationAiProviderModelDto extends AutomationAiProviderModelDto {}

export class UpdateAutomationAiProviderModelDto extends PartialType(
  AutomationAiProviderModelDto,
) {}

export class AutomationAiProviderCandidateHealthDto extends AutomationAiProviderDto {}

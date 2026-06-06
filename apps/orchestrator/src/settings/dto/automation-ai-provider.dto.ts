import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
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

  @ApiProperty({ type: AutomationAiProviderModelSettingsDto })
  @ValidateNested()
  @Type(() => AutomationAiProviderModelSettingsDto)
  settings!: AutomationAiProviderModelSettingsDto;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  default!: boolean;
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

export class DownloadAutomationAiProviderModelDto {
  @ApiProperty({ example: 'qwen3.5:latest' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  modelId!: string;

  @ApiPropertyOptional({ example: 'Qwen 3.5 Latest' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;
}

export class AutomationAiProviderModelDownloadDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  providerId!: string;

  @ApiProperty()
  modelId!: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiProperty({ enum: ['queued', 'running', 'completed', 'failed'] })
  status!: 'queued' | 'running' | 'completed' | 'failed';

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  total?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  completed?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  percent?: number | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  finishedAt?: string | null;
}

export class AutomationAiProviderRemoteModelDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiPropertyOptional()
  family?: string;

  @ApiPropertyOptional()
  parameterSize?: string;

  @ApiPropertyOptional()
  quantizationLevel?: string;
}

export class AutomationAiModelCatalogProviderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: ['openai', 'openai-compatible', 'ollama'] })
  kind!: 'openai' | 'openai-compatible' | 'ollama';

  @ApiProperty({ type: AutomationAiProviderModelDto, isArray: true })
  models!: AutomationAiProviderModelDto[];
}

export class AutomationAiProviderHealthDto {
  @ApiProperty()
  providerId!: string;

  @ApiPropertyOptional()
  modelId?: string;

  @ApiProperty({ enum: ['ok', 'error', 'disabled'] })
  status!: 'ok' | 'error' | 'disabled';

  @ApiProperty()
  message!: string;

  @ApiProperty()
  checkedAt!: string;
}

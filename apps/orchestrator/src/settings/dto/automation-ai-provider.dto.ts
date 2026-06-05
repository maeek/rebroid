import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

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

  @ApiProperty({ default: true })
  @IsBoolean()
  supportsVision!: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  supportsTools!: boolean;

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

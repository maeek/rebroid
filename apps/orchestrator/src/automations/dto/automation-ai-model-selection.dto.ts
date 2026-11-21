import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AutomationAiModelSelectionDto {
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

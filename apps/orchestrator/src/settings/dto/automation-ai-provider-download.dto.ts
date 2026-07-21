import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

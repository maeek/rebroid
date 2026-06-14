import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsIn,
  IsInt,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
  AutomationDefinitionDto,
  AutomationTagDto,
} from './automation-definition.dto';

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

export class DraftAutomationYamlClarificationDto {
  @ApiProperty({ example: 'Which app package should this workflow launch?' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @ApiProperty({ example: 'Use the uploaded app package.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  answer!: string;
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

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['android.tapNormalized', 'android.waitForText'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  allowedTools?: string[];

  @ApiPropertyOptional({
    type: DraftAutomationYamlClarificationDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DraftAutomationYamlClarificationDto)
  clarifications?: DraftAutomationYamlClarificationDto[];
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

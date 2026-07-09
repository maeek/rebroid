import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
  AutomationStartPolicy,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationTagDto } from './automation-definition.dto';

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

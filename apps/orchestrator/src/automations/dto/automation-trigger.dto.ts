import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import { AutomationLastStatus } from '../entities/automation.entity';
import {
  AutomationStartPolicy,
  AutomationTriggerType,
} from '../entities/automation-trigger.entity';
import { AutomationTagDto } from './automation-definition.dto';
import {
  AutomationsGridFacetsDto,
  ListAutomationsGridQueryDto,
} from './automation.dto';

export class ListAutomationTriggersGridQueryDto extends ListAutomationsGridQueryDto {
  @ApiPropertyOptional({ example: 'daily smoke' })
  declare q?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  enabled?: 'true' | 'false';
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

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

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

export class UpdateAutomationScheduleTriggerConfigDto extends PartialType(
  OmitType(AutomationScheduleTriggerConfigDto, ['startPolicy'] as const),
) {
  @ApiPropertyOptional({ enum: AutomationStartPolicy })
  @IsOptional()
  @IsEnum(AutomationStartPolicy)
  startPolicy?: AutomationStartPolicy;
}

export class UpdateAutomationTriggerDto extends PartialType(
  OmitType(CreateAutomationTriggerDto, ['triggerConfig'] as const),
) {
  @ApiPropertyOptional({
    type: UpdateAutomationScheduleTriggerConfigDto,
    description: 'Omitted schedule settings retain their current values.',
  })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;
}

export class AutomationTriggerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

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
  lastRunId!: string | null;

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

export class AutomationTriggersGridFacetsDto extends AutomationsGridFacetsDto {}

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

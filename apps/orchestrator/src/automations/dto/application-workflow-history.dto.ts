import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AutomationRunDto,
  ListActiveAutomationRunsQueryDto,
} from './automation-run.dto';

export class ApplicationWorkflowScopeDto extends ListActiveAutomationRunsQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  targetApplicationId!: string;
}

export class ListApplicationWorkflowRunsDto extends ApplicationWorkflowScopeDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class ApplicationWorkflowRunRowDto extends PickType(AutomationRunDto, [
  'id',
  'automationId',
  'status',
  'trigger',
  'createdAt',
  'startedAt',
  'completedAt',
] as const) {
  @ApiProperty({ type: String, nullable: true })
  automationName!: string | null;
}

export class ApplicationWorkflowRunPageDto {
  @ApiProperty({ type: ApplicationWorkflowRunRowDto, isArray: true })
  items!: ApplicationWorkflowRunRowDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ApplicationWorkflowRunDto extends AutomationRunDto {
  @ApiProperty({ type: String, nullable: true })
  automationName!: string | null;
}

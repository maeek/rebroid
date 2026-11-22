import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import { AutomationStartPolicy } from '../entities/automation-trigger.entity';

export class AutomationOwnerDto {
  @ApiProperty({ example: 'user_123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerUserId!: string;
}

export class AutomationProfileTargetDto extends AutomationOwnerDto {
  @ApiPropertyOptional({ enum: ApplicationProfileMode, nullable: true })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode | null;

  @ApiPropertyOptional({ type: String, example: 'default', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  profileName?: string | null;
}

export class AutomationRunTargetDto extends AutomationProfileTargetDto {
  @ApiPropertyOptional({
    enum: AutomationStartPolicy,
    default: AutomationStartPolicy.RequireRunning,
  })
  @IsOptional()
  @IsEnum(AutomationStartPolicy)
  startPolicy?: AutomationStartPolicy;
}

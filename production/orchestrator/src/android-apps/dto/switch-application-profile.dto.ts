import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApplicationProfileMode } from '../application-profile-mode';

export class SwitchApplicationProfileDto {
  @ApiPropertyOptional({ enum: ApplicationProfileMode, default: ApplicationProfileMode.Persistent })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode;

  @ApiPropertyOptional({ example: 'work' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  profileName?: string;
}

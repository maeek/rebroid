import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationProfileMode } from '../../application-profile-mode';

export class ApplicationRuntimeFilesQueryDto {
  @ApiPropertyOptional({
    enum: ApplicationProfileMode,
    description: 'Profile storage mode to browse when the app is not running.',
  })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode;

  @ApiPropertyOptional({
    example: 'default',
    description: 'Persistent profile name to browse when profileMode is persistent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profileName?: string;
}

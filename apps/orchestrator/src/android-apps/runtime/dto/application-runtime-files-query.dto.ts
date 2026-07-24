import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

export class ApplicationRuntimeFilesQueryDto {
  @ApiPropertyOptional({
    example: '/data',
    description: 'Absolute path inside the active runtime data volume.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  path?: string;

  @ApiPropertyOptional({
    enum: ApplicationProfileMode,
    description: 'Profile storage mode to browse when the app is not running.',
  })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode;

  @ApiPropertyOptional({
    example: 'default',
    description:
      'Persistent profile name to browse when profileMode is persistent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profileName?: string;
}

export class ApplicationRuntimeDataFileUploadQueryDto extends ApplicationRuntimeFilesQueryDto {
  @ApiPropertyOptional({
    example: 'false',
    description:
      'Replace an existing file with the same name. Omitted uploads fail on conflicts.',
  })
  @IsOptional()
  @IsBooleanString()
  overwrite?: string;
}

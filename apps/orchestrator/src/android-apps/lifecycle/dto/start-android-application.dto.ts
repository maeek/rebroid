import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';

export class StartAndroidApplicationDto {
  @ApiPropertyOptional({
    description:
      'Runtime profile mode to use for this start. Persistent uses a named volume; temporary does not.',
    enum: ApplicationProfileMode,
    default: ApplicationProfileMode.Persistent,
  })
  @IsOptional()
  @IsEnum(ApplicationProfileMode)
  profileMode?: ApplicationProfileMode;

  @ApiPropertyOptional({ example: 'default' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  profileName?: string;
}

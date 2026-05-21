import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CloneAndroidApplicationDto {
  @ApiPropertyOptional({
    description: 'Owner user id for the cloned application.',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({
    description: 'Display name for the cloned application. Defaults to the source app name.',
    example: 'Signal Android',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

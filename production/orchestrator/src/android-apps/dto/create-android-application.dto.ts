import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAndroidApplicationDto {
  @ApiProperty({ example: 'Signal Android' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    description: 'Frontend user id that owns the app. No auth is enforced yet.',
    example: 'user_123',
  })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({ example: 'redroid/redroid:13.0.0-latest' })
  @IsOptional()
  @IsString()
  redroidImage?: string;

  @ApiPropertyOptional({ default: 900, minimum: 60, maximum: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  inactivityTimeoutSeconds?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 128, maximum: 262144 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(262144)
  memoryLimitMb?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0.1, maximum: 128 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(128)
  cpuLimitCpus?: number;

  @ApiPropertyOptional({ example: 8192, minimum: 16, maximum: 1048576 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(1048576)
  volumeSizeLimitMb?: number;

  @ApiPropertyOptional({
    example: 'androidboot.redroid_dpi=480 androidboot.redroid_width=1080 androidboot.redroid_height=1920',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redroidArgs?: string;
}

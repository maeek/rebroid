import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateAndroidApplicationDto {
  @ApiPropertyOptional({ example: 'Signal Android' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'user_123' })
  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @ApiPropertyOptional({ minimum: 60, maximum: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  inactivityTimeoutSeconds?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 128, maximum: 262144, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(128)
  @Max(262144)
  memoryLimitMb?: number | null;

  @ApiPropertyOptional({ example: 2, minimum: 0.1, maximum: 128, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(128)
  cpuLimitCpus?: number | null;

  @ApiPropertyOptional({ example: 8192, minimum: 16, maximum: 1048576, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(1048576)
  volumeSizeLimitMb?: number | null;

  @ApiPropertyOptional({ example: 'androidboot.redroid_dpi=480', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redroidArgs?: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
  containerImage?: string;

  @ApiPropertyOptional({
    default: 900,
    minimum: -1,
    maximum: 86400,
    description: 'Use -1 to keep the session running until manually stopped.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-1)
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
    description:
      'Optional command or arguments passed to the container as Docker Cmd. Use a long-running command if the image would otherwise exit immediately.',
    example: 'sleep infinity',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  containerArgs?: string;

  @ApiPropertyOptional({
    description:
      'Previously uploaded APK id to install into this Android application.',
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
  })
  @IsOptional()
  @IsUUID()
  uploadedApkId?: string;
}

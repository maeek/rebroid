import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ScrcpyTransport } from '../android-application-status';

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

  @ApiPropertyOptional({ enum: ScrcpyTransport, default: ScrcpyTransport.WebSocket })
  @IsOptional()
  @IsEnum(ScrcpyTransport)
  scrcpyTransport?: ScrcpyTransport;

  @ApiPropertyOptional({ default: 900, minimum: 60, maximum: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  inactivityTimeoutSeconds?: number;
}

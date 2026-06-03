import { ApiProperty } from '@nestjs/swagger';
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
import { ScrcpyTransport } from '../../android-apps/android-application-status';

export class OrchestratorSettingsDto {
  @ApiProperty({ example: 'redroid/redroid:13.0.0-latest' })
  @IsString()
  @MinLength(3)
  defaultContainerImage!: string;

  @ApiProperty({
    type: String,
    example: 'registry.internal.example:5000',
    nullable: true,
    required: false,
    description:
      'Optional registry prefix applied to image names without an explicit registry host.',
  })
  @IsOptional()
  @IsString()
  dockerImageRegistry!: string | null;

  @ApiProperty({
    enum: [ScrcpyTransport.WebRTC, ScrcpyTransport.WebSocket],
    default: ScrcpyTransport.WebRTC,
  })
  @IsEnum(ScrcpyTransport)
  defaultScrcpyTransport!: ScrcpyTransport;

  @ApiProperty({
    example: 900,
    minimum: -1,
    maximum: 86400,
    description: 'Use -1 to keep sessions running until manually stopped.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(-1)
  @Max(86400)
  defaultInactivityTimeoutSeconds!: number;

  @ApiProperty({ example: 512, minimum: 1, maximum: 512 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(512)
  maxApkUploadSizeMb!: number;
}

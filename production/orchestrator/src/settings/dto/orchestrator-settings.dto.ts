import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
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
    enum: [ScrcpyTransport.WebSocket],
    default: ScrcpyTransport.WebSocket,
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

  @ApiProperty({ example: 512, minimum: 1, maximum: 4096 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  maxApkUploadSizeMb!: number;

  @ApiProperty({ example: 24, minimum: 0, maximum: 8760 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8760)
  imagePruneIntervalHours!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  imagePruneDanglingOnly!: boolean;
}

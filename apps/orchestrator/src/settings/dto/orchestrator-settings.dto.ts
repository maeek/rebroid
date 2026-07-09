import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ScrcpyTransport } from '../../android-apps/contracts/android-application-status';

export class OptionalServiceSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Whether the optional sidecar integration should be used.',
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    example: 'http://ocr-sidecar:4300',
    description:
      'Service endpoint. HTTP(S) URL for HTTP sidecars; socket path for local agent integrations.',
  })
  @IsOptional()
  @IsString()
  endpoint!: string | null;

  @ApiProperty({ example: 15000, minimum: 100, maximum: 120000 })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(120000)
  timeoutMs!: number;
}

export class OcrServiceSettingsDto extends OptionalServiceSettingsDto {
  @ApiProperty({ example: 1600, minimum: 320, maximum: 4096 })
  @Type(() => Number)
  @IsInt()
  @Min(320)
  @Max(4096)
  maxImageDimension!: number;

  @ApiProperty({ example: 0.4, minimum: 0, maximum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence!: number;

  @ApiProperty({ type: [String], example: ['en'] })
  @IsArray()
  @IsString({ each: true })
  languages!: string[];

  @ApiProperty({
    type: [String],
    example: ['raw', 'grayscale', 'contrast', 'threshold'],
  })
  @IsArray()
  @IsString({ each: true })
  preprocessingModes!: string[];
}

export class OptionalServicesSettingsDto {
  @ApiProperty({ type: OcrServiceSettingsDto })
  @Type(() => OcrServiceSettingsDto)
  @IsObject()
  ocr!: OcrServiceSettingsDto;

  @ApiProperty({ type: OptionalServiceSettingsDto })
  @Type(() => OptionalServiceSettingsDto)
  @IsObject()
  firewall!: OptionalServiceSettingsDto;
}

export class OrchestratorSettingsDto {
  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
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

  @ApiProperty({ type: OptionalServicesSettingsDto })
  @Type(() => OptionalServicesSettingsDto)
  @IsObject()
  services!: OptionalServicesSettingsDto;
}

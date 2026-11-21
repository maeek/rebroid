import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  runtimeImageKinds,
  runtimeImageGmsModes,
  runtimeImageSignatureSpoofingStates,
  type RuntimeImageGmsMode,
  type RuntimeImageKind,
  type RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

export class UpdateRuntimeImageMetadataDto {
  @ApiPropertyOptional({ enum: runtimeImageKinds })
  @IsOptional()
  @IsIn(runtimeImageKinds)
  runtimeKind?: RuntimeImageKind;

  @ApiPropertyOptional({ type: String, example: '14', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  androidVersion?: string | null;

  @ApiPropertyOptional({ type: String, example: 'amd64', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  architecture?: string | null;

  @ApiPropertyOptional({ enum: runtimeImageGmsModes })
  @IsOptional()
  @IsIn(runtimeImageGmsModes)
  gmsMode?: RuntimeImageGmsMode;

  @ApiPropertyOptional({ enum: runtimeImageSignatureSpoofingStates })
  @IsOptional()
  @IsIn(runtimeImageSignatureSpoofingStates)
  signatureSpoofing?: RuntimeImageSignatureSpoofing;
}

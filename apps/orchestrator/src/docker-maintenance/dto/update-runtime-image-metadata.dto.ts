import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

const runtimeKinds = ['redroid', 'generic'] as const;
const gmsModes = ['none', 'microg', 'gapps'] as const;
const signatureSpoofingStates = [
  'not_applicable',
  'external_required',
  'present_unverified',
  'verified',
] as const;

export class UpdateRuntimeImageMetadataDto {
  @ApiPropertyOptional({ enum: runtimeKinds })
  @IsOptional()
  @IsIn(runtimeKinds)
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

  @ApiPropertyOptional({ enum: gmsModes })
  @IsOptional()
  @IsIn(gmsModes)
  gmsMode?: RuntimeImageGmsMode;

  @ApiPropertyOptional({ enum: signatureSpoofingStates })
  @IsOptional()
  @IsIn(signatureSpoofingStates)
  signatureSpoofing?: RuntimeImageSignatureSpoofing;
}

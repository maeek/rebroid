import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  featureFlagKeys,
  type FeatureDisablePolicy,
  type FeatureFlagControl,
  type FeatureFlagKey,
} from '../feature-flag.registry';

export class FeatureFlagStateDto {
  @ApiProperty({ enum: featureFlagKeys, example: 'feature.ocr' })
  key!: FeatureFlagKey;

  @ApiProperty({
    enum: ['automations', 'network-policy', 'container-images', 'display'],
  })
  owner!: 'automations' | 'network-policy' | 'container-images' | 'display';

  @ApiProperty({ example: 3, minimum: 0 })
  revision!: number;

  @ApiProperty({ example: 'OCR-backed automation perception.' })
  description!: string;

  @ApiProperty({ enum: ['runtime', 'deployment'] })
  control!: FeatureFlagControl;

  @ApiProperty({ example: true })
  mutable!: boolean;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: true })
  supported!: boolean;

  @ApiProperty({ example: true })
  effective!: boolean;

  @ApiProperty({ enum: ['applied', 'pending', 'restart_required', 'failed'] })
  syncStatus!: 'applied' | 'pending' | 'restart_required' | 'failed';

  @ApiProperty({
    enum: ['block_new', 'drain_active', 'stop_active', 'restart_required'],
  })
  disablePolicy!: FeatureDisablePolicy;

  @ApiProperty({ enum: ['permanent', 'rollout'] })
  lifecycle!: 'permanent' | 'rollout';

  @ApiProperty({ nullable: true, type: String })
  removalCondition!: string | null;

  @ApiProperty({ enum: featureFlagKeys, isArray: true })
  dependencies!: FeatureFlagKey[];

  @ApiProperty({ enum: featureFlagKeys, isArray: true })
  conflicts!: FeatureFlagKey[];
}

export class FeatureFlagManifestDto {
  @ApiProperty({ example: 3, minimum: 0 })
  revision!: number;

  @ApiProperty({ type: FeatureFlagStateDto, isArray: true })
  features!: FeatureFlagStateDto[];
}

export class FeatureFlagChangeDto {
  @ApiProperty({ enum: featureFlagKeys, example: 'feature.ocr' })
  @IsString()
  @IsIn(featureFlagKeys)
  key!: FeatureFlagKey;

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateFeatureFlagsDto {
  @ApiProperty({ example: 3, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  revision!: number;

  @ApiProperty({ type: FeatureFlagChangeDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(featureFlagKeys.length)
  @ValidateNested({ each: true })
  @Type(() => FeatureFlagChangeDto)
  changes!: FeatureFlagChangeDto[];
}

export class ResetFeatureFlagsDto {
  @ApiProperty({ example: 3, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  revision!: number;
}

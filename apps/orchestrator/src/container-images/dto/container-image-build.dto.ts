import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';

import { ContainerImageBuildJob } from '../entities/container-image-build-job.entity';
import {
  containerImageBuildKinds,
  type ContainerImageBuildKind,
} from '../entities/container-image-gapps-build';

export class LatestContainerImageBuildQueryDto {
  @ApiProperty({ enum: containerImageBuildKinds })
  @IsIn(containerImageBuildKinds)
  buildKind!: ContainerImageBuildKind;
}

export class LatestContainerImageBuildDto {
  @ApiProperty({ type: () => ContainerImageBuildJob, nullable: true })
  job!: ContainerImageBuildJob | null;
}

const runtimeKinds = ['redroid', 'generic'] as const;
const gmsModes = ['none', 'microg', 'gapps'] as const;
const signatureSpoofingStates = [
  'not_applicable',
  'external_required',
  'present_unverified',
  'verified',
] as const;

export class CreateContainerImageRecipeDto {
  @ApiProperty({ example: 'Redroid 14 microG overlay' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'local/redroid-microg:14' })
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  targetImage!: string;

  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  baseImage!: string;

  @ApiPropertyOptional({ enum: runtimeKinds, default: 'redroid' })
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

  @ApiPropertyOptional({ enum: gmsModes, default: 'microg' })
  @IsOptional()
  @IsIn(gmsModes)
  gmsMode?: RuntimeImageGmsMode;

  @ApiPropertyOptional({
    enum: signatureSpoofingStates,
    default: 'external_required',
  })
  @IsOptional()
  @IsIn(signatureSpoofingStates)
  signatureSpoofing?: RuntimeImageSignatureSpoofing;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(250_000)
  dockerfile!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  contextFileIds?: string[];
}

export class StartContainerImageBuildDto extends CreateContainerImageRecipeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipeId?: string;
}

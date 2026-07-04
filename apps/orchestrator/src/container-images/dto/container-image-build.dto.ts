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
} from '@rebroid/application-core/redroid-runtime';

const runtimeKinds = ['redroid', 'generic'] as const;
const gmsModes = ['none', 'microg'] as const;
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

  @ApiPropertyOptional({ example: '14', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  androidVersion?: string | null;

  @ApiPropertyOptional({ example: 'amd64', nullable: true })
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

export class UpdateContainerImageRecipeDto {
  @ApiPropertyOptional({ example: 'Redroid 14 microG overlay' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'local/redroid-microg:14' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  targetImage?: string;

  @ApiPropertyOptional({ example: 'redroid/redroid:14.0.0-latest' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  baseImage?: string;

  @ApiPropertyOptional({ enum: runtimeKinds })
  @IsOptional()
  @IsIn(runtimeKinds)
  runtimeKind?: RuntimeImageKind;

  @ApiPropertyOptional({ example: '14', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  androidVersion?: string | null;

  @ApiPropertyOptional({ example: 'amd64', nullable: true })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(250_000)
  dockerfile?: string;

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

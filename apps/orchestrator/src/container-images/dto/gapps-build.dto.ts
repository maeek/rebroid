import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export const supportedGappsAndroidVersions = ['14', '13'] as const;
export type SupportedGappsAndroidVersion =
  (typeof supportedGappsAndroidVersions)[number];

export class StartGappsBuildDto {
  @ApiProperty({ enum: supportedGappsAndroidVersions })
  @IsIn(supportedGappsAndroidVersions)
  androidVersion!: SupportedGappsAndroidVersion;

  @ApiPropertyOptional({ example: 'local/redroid-gapps:14' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]{0,254}$/)
  targetImage?: string;
}

export class GappsBuildPresetDto {
  @ApiProperty({ enum: supportedGappsAndroidVersions })
  androidVersion!: SupportedGappsAndroidVersion;

  @ApiProperty()
  baseImage!: string;

  @ApiProperty()
  sourceBranch!: string;

  @ApiProperty()
  sourceRepository!: string;

  @ApiProperty()
  sourceLink!: string;

  @ApiProperty()
  defaultTargetImage!: string;
}

class GappsBuildResourceStatusDto {
  @ApiProperty()
  canBuild!: boolean;

  @ApiProperty()
  diskAvailableBytes!: number;

  @ApiProperty()
  memoryAvailableBytes!: number;

  @ApiProperty()
  cpuCount!: number;

  @ApiProperty()
  diskRequirementMet!: boolean;

  @ApiProperty()
  memoryRequirementMet!: boolean;

  @ApiProperty()
  cpuRecommendationMet!: boolean;

  @ApiProperty({ isArray: true, type: String })
  messages!: string[];
}

export class GappsBuildPresetsResponseDto {
  @ApiProperty({ type: GappsBuildPresetDto, isArray: true })
  presets!: GappsBuildPresetDto[];

  @ApiProperty({ type: GappsBuildResourceStatusDto })
  resources!: GappsBuildResourceStatusDto;
}

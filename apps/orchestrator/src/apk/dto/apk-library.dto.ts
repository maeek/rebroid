import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  apkBlockScopes,
  type ApkBlockScope,
} from '../entities/apk-block-rule.entity';

const apkLibraryActions = ['block', 'unblock', 'delete'] as const;
type ApkLibraryAction = (typeof apkLibraryActions)[number];

export class ApkLibraryMutationDto {
  @ApiProperty({ enum: apkLibraryActions })
  @IsIn(apkLibraryActions)
  action!: ApkLibraryAction;

  @ApiProperty({ type: [String], maxItems: 100 })
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  ids!: string[];

  @ApiPropertyOptional({ enum: apkBlockScopes })
  @IsOptional()
  @IsIn(apkBlockScopes)
  scope?: ApkBlockScope;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class ApkLibraryRuleDto {
  @ApiProperty({ enum: apkBlockScopes })
  scope!: ApkBlockScope;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  reason!: string;
}

class ApkLibraryAppDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ApkLibraryEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sha256!: string | null;

  @ApiProperty({ type: String, nullable: true })
  packageName!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  sizeBytes!: number | null;

  @ApiProperty({ type: [String] })
  ownerUserIds!: string[];

  @ApiProperty()
  uploads!: number;

  @ApiProperty({ type: [ApkLibraryAppDto] })
  apps!: ApkLibraryAppDto[];

  @ApiProperty({ type: String, nullable: true })
  googlePlayServices!: string | null;

  @ApiProperty({ type: [String] })
  inspectionEvidence!: string[];

  @ApiProperty({ type: [ApkLibraryRuleDto] })
  rules!: ApkLibraryRuleDto[];
}

class ApkLibrarySkippedDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reason!: string;
}

export class ApkLibraryMutationResultDto {
  @ApiProperty({ type: [String] })
  changed!: string[];

  @ApiProperty({ type: [ApkLibrarySkippedDto] })
  skipped!: ApkLibrarySkippedDto[];

  @ApiProperty()
  bytesFreed!: number;
}

import { readGooglePlayServicesEvidence } from '../utils/google-play-services-evidence';
import { ApiProperty } from '@nestjs/swagger';
import { UploadedApk } from '../entities/uploaded-apk.entity';
import {
  googlePlayServicesEvidenceCodes,
  googlePlayServicesVerdicts,
  type GooglePlayServicesEvidenceCode,
} from '../types/google-play-services-analysis';

class GooglePlayServicesAnalysisDto {
  @ApiProperty({ enum: googlePlayServicesVerdicts })
  verdict!: (typeof googlePlayServicesVerdicts)[number];

  @ApiProperty({ enum: googlePlayServicesEvidenceCodes, isArray: true })
  evidence!: GooglePlayServicesEvidenceCode[];

  @ApiProperty({ example: 1 })
  analysisVersion!: number;
}

export class UploadedApkResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  sha256!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ type: String, nullable: true })
  extractedIconDataUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  displayName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  packageName!: string | null;

  @ApiProperty({ type: GooglePlayServicesAnalysisDto })
  googlePlayServices!: GooglePlayServicesAnalysisDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(entity: UploadedApk): UploadedApkResponseDto {
    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      originalName: entity.originalName,
      sha256: entity.sha256,
      sizeBytes: entity.sizeBytes,
      extractedIconDataUrl: entity.extractedIconDataUrl,
      displayName: entity.displayName,
      packageName: entity.packageName,
      googlePlayServices: {
        verdict: entity.googlePlayServicesVerdict,
        evidence: readGooglePlayServicesEvidence(
          entity.googlePlayServicesEvidenceJson,
        ),
        analysisVersion: entity.googlePlayServicesAnalysisVersion,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

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

  @ApiProperty()
  filePath!: string;

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
    const evidence = UploadedApkResponseDto.parseEvidence(
      entity.googlePlayServicesEvidenceJson,
    );
    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      originalName: entity.originalName,
      sha256: entity.sha256,
      sizeBytes: entity.sizeBytes,
      filePath: entity.filePath,
      extractedIconDataUrl: entity.extractedIconDataUrl,
      displayName: entity.displayName,
      packageName: entity.packageName,
      googlePlayServices: {
        verdict: entity.googlePlayServicesVerdict,
        evidence,
        analysisVersion: entity.googlePlayServicesAnalysisVersion,
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private static parseEvidence(
    value: string,
  ): GooglePlayServicesEvidenceCode[] {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      const allowed = new Set<string>(googlePlayServicesEvidenceCodes);
      return parsed.filter(
        (item): item is GooglePlayServicesEvidenceCode =>
          typeof item === 'string' && allowed.has(item),
      );
    } catch {
      return [];
    }
  }
}

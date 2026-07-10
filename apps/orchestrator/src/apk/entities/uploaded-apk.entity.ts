import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GooglePlayServicesVerdict } from '../types/google-play-services-analysis';

@Entity({ name: 'uploaded_apks' })
export class UploadedApk {
  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ type: String, example: 'admin', nullable: true })
  @Column({ type: 'text', nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ example: 'Signal.apk' })
  @Column()
  originalName!: string;

  @ApiProperty({
    example: '9d1e7fdf5f9f4d0e9f3e3a7a66a9ac884e7b68be3e0dd41d7dfc9f4e5ddbdc91',
  })
  @Column()
  sha256!: string;

  @ApiProperty({ example: 74311257 })
  @Column({ type: 'integer' })
  sizeBytes!: number;

  @ApiProperty({ example: '/app/uploads/apks/9d1e7fdf.apk' })
  @Column()
  filePath!: string;

  @ApiProperty({
    type: String,
    example: 'data:image/png;base64,iVBORw0KGgo...',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  extractedIconDataUrl!: string | null;

  @ApiProperty({ type: String, example: 'Signal', nullable: true })
  @Column({ type: 'text', nullable: true })
  displayName!: string | null;

  @ApiProperty({
    type: String,
    example: 'org.thoughtcrime.securesms',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  packageName!: string | null;

  @Column({ type: 'text', default: 'unknown' })
  googlePlayServicesVerdict!: GooglePlayServicesVerdict;

  @Column({ type: 'text', default: "'[]'" })
  googlePlayServicesEvidenceJson!: string;

  @Column({ type: 'integer', default: 1 })
  googlePlayServicesAnalysisVersion!: number;

  @ApiProperty({ example: '2026-05-16T20:39:29.000Z' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-16T20:39:31.000Z' })
  @UpdateDateColumn()
  updatedAt!: Date;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';
import type { RuntimeImageMetadataRecord } from '../../contracts/docker-image-runtime-metadata.port';

@Entity({ name: 'container_image_runtime_metadata' })
export class ContainerImageRuntimeMetadata implements RuntimeImageMetadataRecord {
  @ApiProperty({ example: 'local/redroid-microg:14' })
  @PrimaryColumn()
  imageRef!: string;

  @ApiPropertyOptional({
    example:
      'sha256:abc1234567890abc1234567890abc1234567890abc1234567890abc1234567890',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  imageId!: string | null;

  @ApiProperty({ enum: ['redroid', 'generic'] })
  @Column({ default: 'generic' })
  runtimeKind!: RuntimeImageKind;

  @ApiPropertyOptional({ example: '14', nullable: true })
  @Column({ type: 'text', nullable: true })
  androidVersion!: string | null;

  @ApiPropertyOptional({ example: 'amd64', nullable: true })
  @Column({ type: 'text', nullable: true })
  architecture!: string | null;

  @ApiProperty({ enum: ['none', 'microg', 'gapps'] })
  @Column({ default: 'none' })
  gmsMode!: RuntimeImageGmsMode;

  @ApiProperty({
    enum: [
      'not_applicable',
      'external_required',
      'present_unverified',
      'verified',
    ],
  })
  @Column({ default: 'not_applicable' })
  signatureSpoofing!: RuntimeImageSignatureSpoofing;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;
}

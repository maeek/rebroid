import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  RuntimeImageGmsMode,
  RuntimeImageKind,
  RuntimeImageSignatureSpoofing,
} from '@rebroid/android-application-core/redroid-runtime';
import {
  containerImageBuildStatuses,
  type ContainerImageBuildStatus,
} from './container-image-build-status';
import {
  containerImageBuildCacheStates,
  containerImageBuildKinds,
  containerImageGappsBuildPhases,
  type ContainerImageBuildCacheState,
  type ContainerImageBuildKind,
  type ContainerImageGappsBuildPhase,
} from './container-image-gapps-build';

@Entity({ name: 'container_image_build_jobs' })
export class ContainerImageBuildJob {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  recipeId!: string | null;

  @ApiProperty({ example: 'local/redroid-microg:14' })
  @Column()
  targetImage!: string;

  @ApiProperty({ example: 'redroid/redroid:14.0.0-latest' })
  @Column()
  baseImage!: string;

  @ApiProperty({ enum: containerImageBuildStatuses })
  @Column({ default: 'queued' })
  status!: ContainerImageBuildStatus;

  @ApiProperty({ enum: containerImageBuildKinds })
  @Column({ default: 'dockerfile_overlay' })
  buildKind!: ContainerImageBuildKind;

  @ApiProperty({ enum: containerImageGappsBuildPhases })
  @Column({ default: 'queued' })
  phase!: ContainerImageGappsBuildPhase;

  @ApiProperty({ enum: ['redroid', 'generic'] })
  @Column({ default: 'redroid' })
  runtimeKind!: RuntimeImageKind;

  @ApiPropertyOptional({ type: String, example: '14', nullable: true })
  @Column({ type: 'text', nullable: true })
  androidVersion!: string | null;

  @ApiPropertyOptional({ type: String, example: 'amd64', nullable: true })
  @Column({ type: 'text', nullable: true })
  architecture!: string | null;

  @ApiProperty({ enum: ['none', 'microg', 'gapps'] })
  @Column({ default: 'microg' })
  gmsMode!: RuntimeImageGmsMode;

  @ApiProperty({
    enum: [
      'not_applicable',
      'external_required',
      'present_unverified',
      'verified',
    ],
  })
  @Column({ default: 'external_required' })
  signatureSpoofing!: RuntimeImageSignatureSpoofing;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  resolvedBaseDigest!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  mindTheGappsRevision!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  packageSha256!: string | null;

  @ApiProperty({ enum: containerImageBuildCacheStates })
  @Column({ default: 'not_applicable' })
  cacheState!: ContainerImageBuildCacheState;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @Column({ type: 'simple-json', default: "'{}'" })
  validationResults!: Record<string, unknown>;

  @ApiProperty()
  @Column({ type: 'text' })
  dockerfile!: string;

  @ApiProperty()
  @Column({ type: 'text', default: "'[]'" })
  contextFileIdsJson!: string;

  @ApiProperty({ example: 'Step 1/4 : FROM redroid/redroid:14.0.0-latest' })
  @Column({ type: 'text', default: "''" })
  logTail!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  imageId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  @Column({ type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;
}

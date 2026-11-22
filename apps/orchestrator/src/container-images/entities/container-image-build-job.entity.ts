import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity } from 'typeorm';
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
import { ContainerImageBuildDefinition } from './container-image-build-definition';

@Entity({ name: 'container_image_build_jobs' })
export class ContainerImageBuildJob extends ContainerImageBuildDefinition {
  @ApiPropertyOptional({ type: String, nullable: true })
  @Column({ type: 'text', nullable: true })
  recipeId!: string | null;

  @ApiProperty({ enum: containerImageBuildStatuses })
  @Column({ default: 'queued' })
  status!: ContainerImageBuildStatus;

  @ApiProperty({ enum: containerImageBuildKinds })
  @Column({ default: 'dockerfile_overlay' })
  buildKind!: ContainerImageBuildKind;

  @ApiProperty({ enum: containerImageGappsBuildPhases })
  @Column({ default: 'queued' })
  phase!: ContainerImageGappsBuildPhase;

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
  @Column({ type: 'simple-json', default: '{}' })
  validationResults!: Record<string, unknown>;

  @ApiProperty({ example: 'Step 1/4 : FROM redroid/redroid:14.0.0-latest' })
  @Column({ type: 'text', default: '' })
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
}

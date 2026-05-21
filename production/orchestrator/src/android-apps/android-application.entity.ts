import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationProfileMode } from './application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
  ScrcpyTransport,
} from './android-application-status';

export class AndroidImagePullProgress {
  @ApiProperty({ example: 'Downloading' })
  status!: string;

  @ApiProperty({ example: '120.5 MB' })
  current!: string;

  @ApiProperty({ example: '512 MB' })
  total!: string;

  @ApiPropertyOptional({ example: 'sha256:abc123', nullable: true })
  layerId!: string | null;

  @ApiProperty({ example: 23.5 })
  percent!: number;
}

export class AndroidApplicationError {
  @ApiProperty({
    enum: [
      'container_command_failed',
      'container_exited',
      'container_missing',
      'startup_command_finished',
      'unknown',
    ],
  })
  code!:
    | 'container_command_failed'
    | 'container_exited'
    | 'container_missing'
    | 'startup_command_finished'
    | 'unknown';

  @ApiProperty({ enum: ['provisioning', 'runtime', 'unknown'] })
  phase!: 'provisioning' | 'runtime' | 'unknown';

  @ApiProperty()
  message!: string;

  @ApiProperty()
  retryable!: boolean;

  @ApiPropertyOptional({ nullable: true })
  exitCode!: number | null;

  @ApiPropertyOptional({ nullable: true })
  hint!: string | null;
}

export class AndroidNetworkPolicyResult {
  @ApiProperty({ enum: ['applied', 'skipped', 'error'] })
  status!: 'applied' | 'skipped' | 'error';

  @ApiProperty({
    enum: [
      'applied',
      'apply_failed',
      'container_ip_unavailable',
      'container_not_created',
      'iptables_disabled',
      'policy_disabled',
      'unknown',
    ],
  })
  code!:
    | 'applied'
    | 'apply_failed'
    | 'container_ip_unavailable'
    | 'container_not_created'
    | 'iptables_disabled'
    | 'policy_disabled'
    | 'unknown';

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  hint!: string | null;
}

export class AndroidApplicationStatusDetail {
  @ApiProperty({
    enum: [
      'queued',
      'image_checking',
      'image_pulling',
      'volume_creating',
      'network_creating',
      'orchestrator_network_connecting',
      'container_creating',
      'container_starting',
      'android_booting',
      'apk_installing',
      'ready',
      'stopping',
      'stopped',
      'stopped_recreate_required',
      'removing',
      'removed',
      'error',
      'unknown',
    ],
  })
  code!:
    | 'queued'
    | 'image_checking'
    | 'image_pulling'
    | 'volume_creating'
    | 'network_creating'
    | 'orchestrator_network_connecting'
    | 'container_creating'
    | 'container_starting'
    | 'android_booting'
    | 'apk_installing'
    | 'ready'
    | 'stopping'
    | 'stopped'
    | 'stopped_recreate_required'
    | 'removing'
    | 'removed'
    | 'error'
    | 'unknown';

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ['neutral', 'progress', 'success', 'warning', 'error'] })
  tone!: 'neutral' | 'progress' | 'success' | 'warning' | 'error';
}

@Entity({ name: 'android_applications' })
export class AndroidApplication {
  @ApiProperty({ example: '98a530d6-a45d-466a-9cb4-c023067c4971' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'Signal Android' })
  @Column()
  name!: string;

  @ApiPropertyOptional({ example: 'user_123', nullable: true })
  @Column({ type: 'text', nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({
    enum: AndroidApplicationStatus,
    example: AndroidApplicationStatus.Provisioning,
  })
  @Column({ default: AndroidApplicationStatus.Provisioning })
  status!: AndroidApplicationStatus;

  @ApiProperty({
    enum: AndroidApplicationLifecycleStage,
    example: AndroidApplicationLifecycleStage.ImagePulling,
  })
  @Column({ default: AndroidApplicationLifecycleStage.Queued })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  @ApiPropertyOptional({
    example:
      'Docker image "redroid/redroid:13.0.0-latest" is not available locally. Pulling it now.',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  statusMessage!: string | null;

  @ApiPropertyOptional({
    type: () => AndroidApplicationStatusDetail,
    nullable: true,
  })
  statusDetail!: AndroidApplicationStatusDetail | null;

  @ApiProperty({ example: 'redroid/redroid:13.0.0-latest' })
  @Column()
  containerImage!: string;

  @ApiProperty({ example: 'rebroid-runtime-signal-android-98a530d6' })
  @Column()
  containerName!: string;

  @ApiPropertyOptional({
    example: '3c12ed54f84be96b9068653dd91f52a412312b7dd84dcf302a1a751d5075be49',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  containerId!: string | null;

  @ApiProperty({ example: 'rebroid-net-signal-android-98a530d6' })
  @Column()
  networkName!: string;

  @ApiProperty({ example: 'rebroid-data-signal-android-98a530d6' })
  @Column()
  volumeName!: string;

  @ApiProperty({
    enum: ApplicationProfileMode,
    example: ApplicationProfileMode.Persistent,
  })
  @Column({ default: ApplicationProfileMode.Persistent })
  profileMode!: ApplicationProfileMode;

  @ApiPropertyOptional({ example: 'default', nullable: true })
  @Column({ type: 'text', nullable: true })
  profileName!: string | null;

  @ApiPropertyOptional({ example: 2048, nullable: true })
  @Column({ type: 'integer', nullable: true })
  memoryLimitMb!: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @Column({ type: 'real', nullable: true })
  cpuLimitCpus!: number | null;

  @ApiPropertyOptional({
    description:
      'Advisory size limit. Docker local named volumes do not enforce this without a storage driver.',
    example: 8192,
    nullable: true,
  })
  @Column({ type: 'integer', nullable: true })
  volumeSizeLimitMb!: number | null;

  @ApiPropertyOptional({
    example: 'sleep infinity',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  containerArgs!: string | null;

  @ApiProperty({ example: false })
  @Column({ default: false })
  recreateContainerOnNextStart!: boolean;

  @ApiProperty({ example: true })
  @Column({ default: true })
  networkPolicyEnabled!: boolean;

  @ApiProperty({
    type: [String],
    description:
      'App-specific CIDR allowlist. Backend default destinations are applied separately.',
    example: ['10.20.0.0/16'],
  })
  @Column({ type: 'text', default: '[]' })
  networkPolicyAllowCidrs!: string;

  @ApiPropertyOptional({ example: 'applied', nullable: true })
  @Column({ type: 'text', nullable: true })
  networkPolicyStatus!: string | null;

  @ApiPropertyOptional({
    example: 'Policy applied to DOCKER-USER.',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  networkPolicyMessage!: string | null;

  @ApiPropertyOptional({
    type: () => AndroidNetworkPolicyResult,
    nullable: true,
  })
  networkPolicyResult!: AndroidNetworkPolicyResult | null;

  @ApiPropertyOptional({ example: '2026-05-16T20:40:00.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  networkPolicyAppliedAt!: Date | null;

  @ApiPropertyOptional({
    example: '/app/uploads/98a530d6-a45d-466a-9cb4-c023067c4971.apk',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  apkFilePath!: string | null;

  @ApiPropertyOptional({ example: 'Signal.apk', nullable: true })
  @Column({ type: 'text', nullable: true })
  apkOriginalName!: string | null;

  @ApiPropertyOptional({
    example: '98a530d6-a45d-466a-9cb4-c023067c4971',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  uploadedApkId!: string | null;

  @ApiProperty({ enum: ScrcpyTransport, example: ScrcpyTransport.WebSocket })
  @Column({ default: ScrcpyTransport.WebSocket })
  scrcpyTransport!: ScrcpyTransport;

  @ApiProperty({ example: 5555 })
  @Column({ default: 5555 })
  adbPort!: number;

  @ApiProperty({ example: 900 })
  @Column({ default: 900 })
  inactivityTimeoutSeconds!: number;

  @ApiPropertyOptional({ example: '2026-05-15T20:40:00.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  lastScrcpyActivityAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-05-15T20:40:00.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  lastStartedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-05-15T20:45:00.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  lastStoppedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-05-15T20:39:30.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  provisioningStartedAt!: Date | null;

  @ApiPropertyOptional({ example: '2026-05-15T20:41:20.000Z', nullable: true })
  @Column({ type: 'datetime', nullable: true })
  provisioningCompletedAt!: Date | null;

  @ApiPropertyOptional({
    example: 'Container command failed with exit code 1',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @ApiPropertyOptional({ type: AndroidImagePullProgress, nullable: true })
  imagePullProgress!: AndroidImagePullProgress | null;

  @ApiPropertyOptional({ type: AndroidApplicationError, nullable: true })
  applicationError!: AndroidApplicationError | null;

  @ApiProperty({ example: '2026-05-15T20:39:29.000Z' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-15T20:39:31.000Z' })
  @UpdateDateColumn()
  updatedAt!: Date;
}

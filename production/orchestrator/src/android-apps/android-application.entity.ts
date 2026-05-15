import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
  ScrcpyTransport,
} from './android-application-status';

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

  @ApiProperty({ enum: AndroidApplicationStatus, example: AndroidApplicationStatus.Provisioning })
  @Column({ default: AndroidApplicationStatus.Provisioning })
  status!: AndroidApplicationStatus;

  @ApiProperty({
    enum: AndroidApplicationLifecycleStage,
    example: AndroidApplicationLifecycleStage.ImagePulling,
  })
  @Column({ default: AndroidApplicationLifecycleStage.Queued })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  @ApiPropertyOptional({
    example: 'Docker image "redroid/redroid:13.0.0-latest" is not available locally. Pulling it now.',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  statusMessage!: string | null;

  @ApiProperty({ example: 'redroid/redroid:13.0.0-latest' })
  @Column()
  redroidImage!: string;

  @ApiProperty({ example: 'sma-redroid-signal-android-98a530d6' })
  @Column()
  containerName!: string;

  @ApiPropertyOptional({
    example: '3c12ed54f84be96b9068653dd91f52a412312b7dd84dcf302a1a751d5075be49',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  containerId!: string | null;

  @ApiProperty({ example: 'sma-net-signal-android-98a530d6' })
  @Column()
  networkName!: string;

  @ApiProperty({ example: 'sma-data-signal-android-98a530d6' })
  @Column()
  volumeName!: string;

  @ApiPropertyOptional({
    example: '/app/uploads/98a530d6-a45d-466a-9cb4-c023067c4971.apk',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  apkFilePath!: string | null;

  @ApiPropertyOptional({ example: 'Signal.apk', nullable: true })
  @Column({ type: 'text', nullable: true })
  apkOriginalName!: string | null;

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

  @ApiPropertyOptional({ example: 'Container command failed with exit code 1', nullable: true })
  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @ApiProperty({ example: '2026-05-15T20:39:29.000Z' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-15T20:39:31.000Z' })
  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ScheduledTaskActionType {
  CleanUploadedApks = 'clean_uploaded_apks',
  PruneImages = 'prune_images',
  PruneContainers = 'prune_containers',
  PruneNetworks = 'prune_networks',
  PruneVolumes = 'prune_volumes',
  PruneAll = 'prune_all',
  CleanRuntimeLogs = 'clean_runtime_logs',
}

export enum ScheduledTaskLastStatus {
  NeverRun = 'never_run',
  Success = 'success',
  Failed = 'failed',
}

export enum ScheduledTaskKind {
  Predefined = 'predefined',
  Custom = 'custom',
}

@Entity({ name: 'scheduled_tasks' })
export class ScheduledTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ default: ScheduledTaskKind.Custom })
  kind!: ScheduledTaskKind;

  @Column({ type: 'varchar', nullable: true })
  predefinedKey!: string | null;

  @Column()
  cronExpression!: string;

  @Column()
  actionType!: ScheduledTaskActionType;

  @Column({ type: 'text', nullable: true })
  payloadJson!: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt!: Date | null;

  @Column({ default: ScheduledTaskLastStatus.NeverRun })
  lastStatus!: ScheduledTaskLastStatus;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

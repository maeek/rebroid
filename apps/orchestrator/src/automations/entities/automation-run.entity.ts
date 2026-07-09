import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AutomationRunStatus {
  Queued = 'queued',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Canceled = 'canceled',
}

export enum AutomationRunTrigger {
  Manual = 'manual',
  Schedule = 'schedule',
  Webhook = 'webhook',
  Event = 'event',
}

@Entity({ name: 'automation_runs' })
export class AutomationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  automationId!: string;

  @Column({ type: 'varchar', nullable: true })
  automationTriggerId!: string | null;

  @Column({ type: 'text' })
  ownerUserId!: string;

  @Column()
  targetApplicationId!: string;

  @Column({ type: 'varchar', nullable: true })
  targetProfileMode!: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetProfileName!: string | null;

  @Column()
  trigger!: AutomationRunTrigger;

  @Column({ default: AutomationRunStatus.Queued })
  status!: AutomationRunStatus;

  @Column({ type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'text', nullable: false, default: "'[]'" })
  stepResultsJson!: string;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  lastEventSequence!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

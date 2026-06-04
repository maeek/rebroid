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
}

@Entity({ name: 'automation_runs' })
export class AutomationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  automationId!: string;

  @Column({ type: 'text' })
  ownerUserId!: string;

  @Column()
  targetApplicationId!: string;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

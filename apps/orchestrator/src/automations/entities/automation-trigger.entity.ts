import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AutomationLastStatus } from './automation.entity';

export enum AutomationTriggerType {
  Schedule = 'schedule',
  Webhook = 'webhook',
  Event = 'event',
}

export enum AutomationStartPolicy {
  RequireRunning = 'require-running',
  StartIfNeeded = 'start-if-needed',
}

@Entity({ name: 'automation_triggers' })
export class AutomationTrigger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  ownerUserId!: string;

  @Column()
  name!: string;

  @Column()
  automationId!: string;

  @Column()
  targetApplicationId!: string;

  @Column({ type: 'varchar', nullable: true })
  profileMode!: string | null;

  @Column({ type: 'varchar', nullable: true })
  profileName!: string | null;

  @Column({ default: true })
  enabled!: boolean;

  @Column()
  triggerType!: AutomationTriggerType;

  @Column({ type: 'text' })
  triggerConfigJson!: string;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt!: Date | null;

  @Column({ default: AutomationLastStatus.NeverRun })
  lastStatus!: AutomationLastStatus;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

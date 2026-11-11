import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'text', nullable: true })
  description!: string | null;

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

  @Column({ type: 'text', default: '[]' })
  tagsJson!: string;

  @Column()
  triggerType!: AutomationTriggerType;

  @Column({ type: 'text' })
  triggerConfigJson!: string;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastEnqueueFailureAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastEnqueueError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

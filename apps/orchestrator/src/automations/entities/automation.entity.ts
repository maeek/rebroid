import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AutomationLastStatus {
  NeverRun = 'never_run',
  Success = 'success',
  Failed = 'failed',
  Running = 'running',
}

@Entity({ name: 'automations' })
export class Automation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  ownerUserId!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text' })
  definitionJson!: string;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt!: Date | null;

  @Column({ default: AutomationLastStatus.NeverRun })
  lastStatus!: AutomationLastStatus;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

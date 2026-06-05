import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'automation_run_events' })
export class AutomationRunEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  runId!: string;

  @Column({ type: 'text' })
  ownerUserId!: string;

  @Column({ type: 'integer' })
  sequence!: number;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'text', nullable: true })
  stepId!: string | null;

  @Column({ type: 'text', nullable: true })
  parentStepId!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', nullable: false, default: "'{}'" })
  dataJson!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

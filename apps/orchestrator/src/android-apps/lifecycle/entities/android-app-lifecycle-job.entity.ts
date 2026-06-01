import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AndroidAppLifecycleJobKind {
  Provision = 'provision',
  Start = 'start',
  InstallApk = 'install_apk',
  Remove = 'remove',
}

export enum AndroidAppLifecycleJobStatus {
  Pending = 'pending',
  Running = 'running',
}

@Entity({ name: 'android_app_lifecycle_jobs' })
export class AndroidAppLifecycleJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  applicationId!: string;

  @Column()
  kind!: AndroidAppLifecycleJobKind;

  @Column({ default: AndroidAppLifecycleJobStatus.Pending })
  status!: AndroidAppLifecycleJobStatus;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  payloadJson!: string | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

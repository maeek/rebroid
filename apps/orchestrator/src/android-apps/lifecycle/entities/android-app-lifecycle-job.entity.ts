import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AndroidAppLifecycleJobKind {
  Provision = 'provision',
  Start = 'start',
  Recreate = 'recreate',
  InstallApk = 'install_apk',
  Remove = 'remove',
}

export enum AndroidAppLifecycleJobStatus {
  Pending = 'pending',
  Running = 'running',
}

@Entity({ name: 'android_device_lifecycle_jobs' })
@Index('android_device_lifecycle_jobs_device_unique', ['applicationId'], {
  unique: true,
})
export class AndroidAppLifecycleJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'deviceId' })
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

export type AndroidAppLifecycleReservation = Readonly<
  Pick<AndroidAppLifecycleJob, 'id' | 'applicationId' | 'kind'>
>;

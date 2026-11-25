import type {
  ExternalDeviceConnection,
  ExternalDeviceTransport,
} from '@rebroid/android-application-core/android-device';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('external_android_devices')
@Index(
  'external_android_devices_transport_selector_unique',
  ['transport', 'selector'],
  { unique: true },
)
export class ExternalAndroidDevice {
  @PrimaryColumn()
  id!: string;
  @Column()
  ownerUserId!: string;
  @Column()
  name!: string;
  @Column({ type: 'varchar' })
  transport!: ExternalDeviceTransport;
  @Column()
  selector!: string;
  @Column({ type: 'varchar', nullable: true })
  attemptId!: string | null;
  @Column({ type: 'simple-json' })
  connection!: ExternalDeviceConnection;
  @Column({ type: 'datetime', nullable: true })
  lastActivityAt!: Date | null;
  @Column({ type: 'integer', nullable: true })
  maxSessionSeconds!: number | null;
  @CreateDateColumn()
  createdAt!: Date;
}

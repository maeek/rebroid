import { ApiProperty } from '@nestjs/swagger';
import {
  managedAndroidDeviceKind,
  type ManagedAndroidDeviceKind,
} from '@rebroid/android-application-core/android-device';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidApplication } from '../../android-application.entity';

export class AndroidDeviceViewerTargetDto {
  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiProperty({ enum: [managedAndroidDeviceKind] })
  kind!: ManagedAndroidDeviceKind;

  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Identity of the current runtime recorded for viewer authorization.',
  })
  runtimeId!: string | null;

  static fromRuntime(
    device: Pick<
      AndroidApplication,
      'id' | 'kind' | 'ownerUserId' | 'status' | 'containerId'
    >,
  ): AndroidDeviceViewerTargetDto {
    return {
      deviceId: device.id,
      kind: device.kind,
      ownerUserId: device.ownerUserId,
      runtimeId:
        device.status === AndroidApplicationStatus.Running
          ? device.containerId
          : null,
    };
  }
}

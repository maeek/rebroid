import { ApiProperty } from '@nestjs/swagger';
import {
  managedAndroidDeviceKind,
  managedAndroidDeviceOperations,
  type ManagedAndroidDeviceKind,
  type ManagedAndroidDeviceOperation,
} from '@rebroid/android-application-core/android-device';

export class ManagedAndroidDeviceDto {
  @ApiProperty({ enum: [managedAndroidDeviceKind] })
  kind!: ManagedAndroidDeviceKind;

  @ApiProperty({
    enum: managedAndroidDeviceOperations,
    isArray: true,
    description:
      'Operations offered by the provider. Account permissions, feature flags, and runtime readiness are checked separately.',
  })
  operations!: readonly ManagedAndroidDeviceOperation[];

  static describe(kind: ManagedAndroidDeviceKind): ManagedAndroidDeviceDto {
    return { kind, operations: managedAndroidDeviceOperations };
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { ManagedAndroidDeviceDto } from './managed-android-device.dto';
import type { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';

export class AndroidApplicationNavigationRowDto extends ManagedAndroidDeviceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ enum: AndroidApplicationStatus })
  status!: AndroidApplicationStatus;

  @ApiProperty({ enum: AndroidApplicationLifecycleStage })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  static fromEntity(
    app: AndroidApplication,
  ): AndroidApplicationNavigationRowDto {
    const { id, name, ownerUserId, status, lifecycleStage } = app;
    return {
      ...ManagedAndroidDeviceDto.describe(app.kind),
      id,
      name,
      ownerUserId,
      status,
      lifecycleStage,
    };
  }
}

export class AndroidApplicationGalleryRowDto extends AndroidApplicationNavigationRowDto {
  @ApiProperty()
  containerImage!: string;

  @ApiProperty({ type: String, nullable: true })
  apkPackageName!: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static override fromEntity(
    app: AndroidApplication,
  ): AndroidApplicationGalleryRowDto {
    return {
      ...super.fromEntity(app),
      containerImage: app.containerImage,
      apkPackageName: app.apkPackageName,
      updatedAt: app.updatedAt.toISOString(),
    };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { AndroidApplicationStatusDetail } from '../../android-application.entity';

export class AndroidApplicationSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ enum: AndroidApplicationStatus })
  currentStatus!: AndroidApplicationStatus;

  @ApiProperty({ enum: AndroidApplicationLifecycleStage })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  @ApiPropertyOptional({
    type: () => AndroidApplicationStatusDetail,
    nullable: true,
  })
  detail!: AndroidApplicationStatusDetail | null;

  @ApiPropertyOptional({ nullable: true })
  apkPackageName!: string | null;

  static fromEntity(
    app: AndroidApplication,
  ): AndroidApplicationSummaryResponseDto {
    return {
      id: app.id,
      name: app.name,
      ownerUserId: app.ownerUserId,
      currentStatus: app.status,
      lifecycleStage: app.lifecycleStage,
      detail: app.statusDetail,
      apkPackageName: app.apkPackageName,
    };
  }
}

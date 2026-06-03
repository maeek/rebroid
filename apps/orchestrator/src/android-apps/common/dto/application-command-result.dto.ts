import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { parseJsonStringArray } from '../../../common/json-array';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { ApplicationProfileMode } from '../../application-profile-mode';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

export class ApplicationCommandNetworkPolicyDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String] })
  allowCidrs!: string[];

  @ApiProperty({ type: String, nullable: true })
  status!: string | null;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({ type: String, nullable: true })
  appliedAt!: string | null;
}

export class ApplicationCommandProfileDto {
  @ApiProperty({ enum: ApplicationProfileMode })
  mode!: ApplicationProfileMode;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;
}

export class ApplicationCommandApkDto {
  @ApiProperty({ type: String, nullable: true })
  uploadedApkId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  packageName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  originalName!: string | null;
}

export class ApplicationCommandResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: AndroidApplicationStatus })
  status!: AndroidApplicationStatus;

  @ApiProperty({ enum: AndroidApplicationLifecycleStage })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiPropertyOptional({ type: String })
  operationId?: string;

  @ApiPropertyOptional({ type: () => ApplicationCommandNetworkPolicyDto })
  networkPolicy?: ApplicationCommandNetworkPolicyDto;

  @ApiPropertyOptional({ type: () => ApplicationCommandProfileDto })
  profile?: ApplicationCommandProfileDto;

  @ApiPropertyOptional({ type: () => ApplicationCommandApkDto })
  apk?: ApplicationCommandApkDto;

  static fromEntity(
    app: AndroidApplication,
    options: { operationId?: string } = {},
  ): ApplicationCommandResultDto {
    return {
      id: app.id,
      name: app.name,
      status: app.status,
      lifecycleStage: app.lifecycleStage,
      message: app.statusMessage,
      operationId: options.operationId,
      networkPolicy: {
        enabled: app.networkPolicyEnabled,
        allowCidrs: parseJsonStringArray(app.networkPolicyAllowCidrs),
        status: app.networkPolicyStatus,
        message: app.networkPolicyMessage,
        appliedAt: toIso(app.networkPolicyAppliedAt),
      },
      profile: {
        mode: app.profileMode,
        name: app.profileName,
      },
      apk: {
        uploadedApkId: app.uploadedApkId,
        packageName: app.apkPackageName,
        originalName: app.apkOriginalName,
      },
    };
  }
}

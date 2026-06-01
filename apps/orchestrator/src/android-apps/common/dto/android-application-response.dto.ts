import { ApiProperty } from '@nestjs/swagger';
import { parseJsonStringArray } from '../../../common/json-array';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../application-profile-mode';
import { parseSavedProfiles } from '../utils/android-apps-profile-history.utils';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
  ScrcpyTransport,
} from '../../android-application-status';
import {
  AndroidApplicationError,
  AndroidApplicationStatusDetail,
  AndroidImagePullProgress,
  AndroidNetworkPolicyResult,
} from '../../android-application.entity';

const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

export class AndroidApplicationStatusResponseDto {
  @ApiProperty({ enum: AndroidApplicationStatus })
  currentStatus!: AndroidApplicationStatus;

  @ApiProperty({ enum: AndroidApplicationLifecycleStage })
  lifecycleStage!: AndroidApplicationLifecycleStage;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({
    type: () => AndroidApplicationStatusDetail,
    nullable: true,
  })
  detail!: AndroidApplicationStatusDetail | null;

  @ApiProperty({ type: () => AndroidImagePullProgress, nullable: true })
  progress!: AndroidImagePullProgress | null;

  @ApiProperty()
  recreateRequired!: boolean;

  @ApiProperty({ type: String, nullable: true })
  lastScrcpyActivityAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastStartedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastStoppedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  provisioningStartedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  provisioningCompletedAt!: string | null;
}

export class AndroidApplicationErrorResponseDto {
  @ApiProperty({ type: String, nullable: true })
  lastError!: string | null;

  @ApiProperty({ type: () => AndroidApplicationError, nullable: true })
  application!: AndroidApplicationError | null;
}

export class AndroidApplicationRuntimeResourcesDto {
  @ApiProperty({ type: Number, nullable: true })
  memoryLimitMb!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  cpuLimitCpus!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  volumeSizeLimitMb!: number | null;
}

export class AndroidApplicationRuntimeDto {
  @ApiProperty()
  image!: string;

  @ApiProperty()
  containerName!: string;

  @ApiProperty({ type: String, nullable: true })
  containerId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  containerArgs!: string | null;

  @ApiProperty()
  adbPort!: number;

  @ApiProperty({ enum: ScrcpyTransport })
  scrcpyTransport!: ScrcpyTransport;

  @ApiProperty()
  inactivityTimeoutSeconds!: number;

  @ApiProperty({ type: () => AndroidApplicationRuntimeResourcesDto })
  resources!: AndroidApplicationRuntimeResourcesDto;
}

export class AndroidApplicationStorageDto {
  @ApiProperty()
  volumeName!: string;

  @ApiProperty({ enum: ApplicationProfileMode })
  profileMode!: ApplicationProfileMode;

  @ApiProperty({ type: String, nullable: true })
  profileName!: string | null;

  @ApiProperty({ type: () => [AndroidApplicationSavedProfileDto] })
  savedProfiles!: AndroidApplicationSavedProfileDto[];
}

export class AndroidApplicationSavedProfileDto {
  @ApiProperty({ enum: ApplicationProfileMode })
  mode!: ApplicationProfileMode;

  @ApiProperty()
  name!: string;
}

export class AndroidApplicationNetworkPolicyDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String] })
  allowCidrs!: string[];

  @ApiProperty({ type: String, nullable: true })
  status!: string | null;

  @ApiProperty({ type: String, nullable: true })
  message!: string | null;

  @ApiProperty({
    type: () => AndroidNetworkPolicyResult,
    nullable: true,
  })
  result!: AndroidNetworkPolicyResult | null;

  @ApiProperty({ type: String, nullable: true })
  appliedAt!: string | null;
}

export class AndroidApplicationNetworkDto {
  @ApiProperty()
  networkName!: string;

  @ApiProperty({ type: () => AndroidApplicationNetworkPolicyDto })
  policy!: AndroidApplicationNetworkPolicyDto;
}

export class AndroidApplicationApkDto {
  @ApiProperty({ type: String, nullable: true })
  filePath!: string | null;

  @ApiProperty({ type: String, nullable: true })
  originalName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  packageName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  uploadedApkId!: string | null;
}

export class AndroidApplicationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  ownerUserId!: string | null;

  @ApiProperty({ type: () => AndroidApplicationStatusResponseDto })
  status!: AndroidApplicationStatusResponseDto;

  @ApiProperty({ type: () => AndroidApplicationErrorResponseDto })
  errors!: AndroidApplicationErrorResponseDto;

  @ApiProperty({ type: () => AndroidApplicationRuntimeDto })
  runtime!: AndroidApplicationRuntimeDto;

  @ApiProperty({ type: () => AndroidApplicationStorageDto })
  storage!: AndroidApplicationStorageDto;

  @ApiProperty({ type: () => AndroidApplicationNetworkDto })
  network!: AndroidApplicationNetworkDto;

  @ApiProperty({ type: () => AndroidApplicationApkDto })
  apk!: AndroidApplicationApkDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromEntity(app: AndroidApplication): AndroidApplicationResponseDto {
    return {
      id: app.id,
      name: app.name,
      ownerUserId: app.ownerUserId,
      status: {
        currentStatus: app.status,
        lifecycleStage: app.lifecycleStage,
        message: app.statusMessage,
        detail: app.statusDetail,
        progress: app.imagePullProgress,
        recreateRequired: app.recreateContainerOnNextStart,
        lastScrcpyActivityAt: toIso(app.lastScrcpyActivityAt),
        lastStartedAt: toIso(app.lastStartedAt),
        lastStoppedAt: toIso(app.lastStoppedAt),
        provisioningStartedAt: toIso(app.provisioningStartedAt),
        provisioningCompletedAt: toIso(app.provisioningCompletedAt),
      },
      errors: {
        lastError: app.lastError,
        application: app.applicationError,
      },
      runtime: {
        image: app.containerImage,
        containerName: app.containerName,
        containerId: app.containerId,
        containerArgs: app.containerArgs,
        adbPort: app.adbPort,
        scrcpyTransport: app.scrcpyTransport,
        inactivityTimeoutSeconds: app.inactivityTimeoutSeconds,
        resources: {
          memoryLimitMb: app.memoryLimitMb,
          cpuLimitCpus: app.cpuLimitCpus,
          volumeSizeLimitMb: app.volumeSizeLimitMb,
        },
      },
      storage: {
        volumeName: app.volumeName,
        profileMode: app.profileMode,
        profileName: app.profileName,
        savedProfiles: parseSavedProfiles(app.savedProfilesJson),
      },
      network: {
        networkName: app.networkName,
        policy: {
          enabled: app.networkPolicyEnabled,
          allowCidrs: parseJsonStringArray(app.networkPolicyAllowCidrs),
          status: app.networkPolicyStatus,
          message: app.networkPolicyMessage,
          result: app.networkPolicyResult,
          appliedAt: toIso(app.networkPolicyAppliedAt),
        },
      },
      apk: {
        filePath: app.apkFilePath,
        originalName: app.apkOriginalName,
        packageName: app.apkPackageName,
        uploadedApkId: app.uploadedApkId,
      },
      createdAt: toIso(app.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(app.updatedAt) ?? new Date().toISOString(),
    };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { parseJsonStringArray } from '../../../common/json-array';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../application-profile-mode';
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

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiPropertyOptional({
    type: () => AndroidApplicationStatusDetail,
    nullable: true,
  })
  detail!: AndroidApplicationStatusDetail | null;

  @ApiPropertyOptional({ type: () => AndroidImagePullProgress, nullable: true })
  progress!: AndroidImagePullProgress | null;

  @ApiProperty()
  recreateRequired!: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastScrcpyActivityAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastStartedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastStoppedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  provisioningStartedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  provisioningCompletedAt!: string | null;
}

export class AndroidApplicationErrorResponseDto {
  @ApiPropertyOptional({ nullable: true })
  lastError!: string | null;

  @ApiPropertyOptional({ type: () => AndroidApplicationError, nullable: true })
  application!: AndroidApplicationError | null;
}

export class AndroidApplicationRuntimeResourcesDto {
  @ApiPropertyOptional({ nullable: true })
  memoryLimitMb!: number | null;

  @ApiPropertyOptional({ nullable: true })
  cpuLimitCpus!: number | null;

  @ApiPropertyOptional({ nullable: true })
  volumeSizeLimitMb!: number | null;
}

export class AndroidApplicationRuntimeDto {
  @ApiProperty()
  image!: string;

  @ApiProperty()
  containerName!: string;

  @ApiPropertyOptional({ nullable: true })
  containerId!: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  profileName!: string | null;
}

export class AndroidApplicationNetworkPolicyDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: [String] })
  allowCidrs!: string[];

  @ApiPropertyOptional({ nullable: true })
  status!: string | null;

  @ApiPropertyOptional({ nullable: true })
  message!: string | null;

  @ApiPropertyOptional({
    type: () => AndroidNetworkPolicyResult,
    nullable: true,
  })
  result!: AndroidNetworkPolicyResult | null;

  @ApiPropertyOptional({ nullable: true })
  appliedAt!: string | null;
}

export class AndroidApplicationNetworkDto {
  @ApiProperty()
  networkName!: string;

  @ApiProperty({ type: () => AndroidApplicationNetworkPolicyDto })
  policy!: AndroidApplicationNetworkPolicyDto;
}

export class AndroidApplicationApkDto {
  @ApiPropertyOptional({ nullable: true })
  filePath!: string | null;

  @ApiPropertyOptional({ nullable: true })
  originalName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  packageName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  uploadedApkId!: string | null;
}

export class AndroidApplicationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
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

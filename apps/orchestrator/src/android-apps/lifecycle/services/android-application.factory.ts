import { runtimeResourceNames } from '../../../network-isolation/runtime-resource-names';
import { ConflictException, Injectable } from '@nestjs/common';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
import { DockerEngineConfigService } from '../../../config/docker-engine-config.service';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { rememberSavedProfile } from '../../common/utils/android-apps-profile-history.utils';
import { applyRedroidDefaultContainerArgs } from '@rebroid/android-application-core/redroid-runtime';
import type { RuntimeImageKind } from '@rebroid/android-application-core/redroid-runtime';
import type { UploadedApkReference } from '../../../apk/contracts/apk-catalog.port';

type ApplicationSettings = Awaited<ReturnType<SettingsService['getSettings']>>;
@Injectable()
export class AndroidApplicationFactory {
  constructor(
    private readonly redroidConfig: RedroidRuntimeConfigService,
    private readonly dockerConfig: DockerEngineConfigService,
  ) {}

  initialFields(
    dto: CreateAndroidApplicationDto,
    settings: ApplicationSettings,
    containerImage: string,
    runtimeKind: RuntimeImageKind,
  ): Partial<AndroidApplication> {
    return {
      name: dto.name,
      ownerUserId: dto.ownerUserId ?? null,
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.Queued,
      statusMessage: 'Provisioning has been queued.',
      containerImage,
      runtimeKind,
      containerName: 'pending',
      networkName: 'pending',
      volumeName: 'pending',
      containerId: null,
      apkFilePath: null,
      apkOriginalName: null,
      apkPackageName: null,
      uploadedApkId: null,
      scrcpyTransport: settings.defaultScrcpyTransport,
      adbPort: this.redroidConfig.adbPort,
      inactivityTimeoutSeconds:
        dto.inactivityTimeoutSeconds ??
        settings.defaultInactivityTimeoutSeconds,
      profileMode: ApplicationProfileMode.Persistent,
      profileName: 'default',
      savedProfilesJson: rememberSavedProfile(null, {
        mode: ApplicationProfileMode.Persistent,
        name: 'default',
      }),
      memoryLimitMb: dto.memoryLimitMb ?? null,
      cpuLimitCpus: dto.cpuLimitCpus ?? null,
      containerArgs: applyRedroidDefaultContainerArgs(
        containerImage,
        dto.containerArgs,
        runtimeKind,
      ),
      recreateContainerOnNextStart: false,
      removeDataOnRemoval: false,
      networkPolicyEnabled: dto.networkPolicyEnabled ?? true,
      networkPolicyAllowCidrs: JSON.stringify(
        dto.networkPolicyAllowCidrs ?? [],
      ),
      networkPolicyStatus: null,
      networkPolicyMessage: null,
      networkPolicyAppliedAt: null,
      lastScrcpyActivityAt: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      provisioningStartedAt: null,
      provisioningCompletedAt: null,
      lastError: null,
    };
  }

  assignGeneratedNames(app: AndroidApplication) {
    const { containerName, networkName, volumeFor } = runtimeResourceNames(
      app,
      this.dockerConfig.resourcePrefix,
    );
    Object.assign(app, {
      containerName,
      networkName,
      volumeName: volumeFor(app.profileName),
    });
  }

  applyUploadedApk(app: AndroidApplication, uploadedApk: UploadedApkReference) {
    if (
      uploadedApk.ownerUserId &&
      app.ownerUserId &&
      uploadedApk.ownerUserId !== app.ownerUserId
    ) {
      throw new ConflictException('Uploaded APK belongs to a different owner.');
    }

    app.uploadedApkId = uploadedApk.id;
    app.apkFilePath = uploadedApk.filePath;
    app.apkOriginalName = uploadedApk.originalName;
    app.apkPackageName = null;
  }
}

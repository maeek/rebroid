import { ConflictException, Injectable } from '@nestjs/common';
import { UploadedApk } from '../../../apk/entities/uploaded-apk.entity';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileMode } from '../../application-profile-mode';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { resolveContainerImage } from '../../common/utils/android-apps-container-image.utils';
import { rememberSavedProfile } from '../../common/utils/android-apps-profile-history.utils';
import { applyRedroidDefaultContainerArgs } from '../../provisioning/utils/redroid-runtime.utils';

type ApplicationSettings = Awaited<ReturnType<SettingsService['getSettings']>>;

@Injectable()
export class AndroidApplicationFactory {
  constructor(
    private readonly redroidConfig: RedroidRuntimeConfigService,
    private readonly networkIsolation: NetworkIsolationService,
  ) {}

  initialFields(
    dto: CreateAndroidApplicationDto,
    settings: ApplicationSettings,
  ): Partial<AndroidApplication> {
    const containerImage = resolveContainerImage(
      dto.containerImage ?? settings.defaultContainerImage,
      settings.dockerImageRegistry,
    );

    return {
      name: dto.name,
      ownerUserId: dto.ownerUserId ?? null,
      status: AndroidApplicationStatus.Provisioning,
      lifecycleStage: AndroidApplicationLifecycleStage.Queued,
      statusMessage: 'Provisioning has been queued.',
      containerImage,
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
    Object.assign(
      app,
      this.networkIsolation.namesFor(app.id, app.name, app.profileName),
    );
  }

  applyUploadedApk(app: AndroidApplication, uploadedApk: UploadedApk) {
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

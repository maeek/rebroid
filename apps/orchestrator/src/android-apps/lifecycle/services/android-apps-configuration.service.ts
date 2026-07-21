import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { resolveContainerImage } from '../../../common/container-image-reference';
import { applyRedroidDefaultContainerArgs } from '@rebroid/android-application-core/redroid-runtime';
import {
  APK_CATALOG,
  type ApkCatalogPort,
} from '../../../apk/contracts/apk-catalog.port';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
import { CloneAndroidApplicationDto } from '../../common/dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppsApkInstallLifecycleService } from '../../provisioning/services/android-apps-apk-install-lifecycle.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import { AndroidApplicationFactory } from './android-application.factory';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import { AndroidRuntimeImageResolverService } from './android-runtime-image-resolver.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';

@Injectable()
export class AndroidAppsConfigurationService {
  constructor(
    private readonly applications: AndroidApplicationsRepository,
    @Inject(APK_CATALOG) private readonly apks: ApkCatalogPort,
    private readonly applicationFactory: AndroidApplicationFactory,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
    private readonly apkInstall: AndroidAppsApkInstallLifecycleService,
    private readonly logs: AndroidAppsLogService,
    private readonly provisioning: AndroidAppsProvisioningService,
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly runtimeImages: AndroidRuntimeImageResolverService,
    private readonly runtimePreparation: AndroidAppsRuntimePreparationService,
    private readonly settings: SettingsService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  async create(dto: CreateAndroidApplicationDto) {
    const [settings, uploadedApk] = await Promise.all([
      this.settings.getSettings(),
      dto.uploadedApkId
        ? this.apks.get(dto.uploadedApkId)
        : Promise.resolve(null),
    ]);
    const containerImage = resolveContainerImage(
      dto.containerImage ?? settings.defaultContainerImage,
      settings.dockerImageRegistry,
    );
    const runtimeKind = await this.runtimeImages.resolveKind(containerImage);
    const app = this.applications.create(
      this.applicationFactory.initialFields(dto, settings, runtimeKind),
    );

    await this.writer.save(app);
    this.applicationFactory.assignGeneratedNames(app);
    if (uploadedApk) {
      this.applicationFactory.applyUploadedApk(app, uploadedApk);
    }
    await this.writer.save(app);
    await this.logs.append(app.id, 'Application record created', {
      name: app.name,
      ownerUserId: app.ownerUserId,
      image: app.containerImage,
      hasApk: Boolean(uploadedApk),
    });

    this.tracker.reset(app.id);
    await this.transitions.beginJob(
      app.id,
      AndroidAppLifecycleJobKind.Provision,
      {},
    );
    this.backgroundJobs.schedule(`provision:${app.id}`, () =>
      this.provisioning.provision(app.id),
    );
    return this.queries.decorate(app);
  }

  async clone(id: string, dto: CloneAndroidApplicationDto) {
    const source = await this.reconciler.reconcileById(id);
    const ownerUserId = dto.ownerUserId?.trim() || null;
    const uploadedApk = source.uploadedApkId
      ? await this.apks.cloneForOwner(source.uploadedApkId, ownerUserId)
      : null;

    return this.create({
      name: dto.name?.trim() || source.name,
      ownerUserId: ownerUserId ?? undefined,
      containerImage: source.containerImage,
      inactivityTimeoutSeconds: source.inactivityTimeoutSeconds,
      memoryLimitMb: source.memoryLimitMb ?? undefined,
      cpuLimitCpus: source.cpuLimitCpus ?? undefined,
      containerArgs: source.containerArgs ?? undefined,
      uploadedApkId: uploadedApk?.id,
    });
  }

  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const app = await this.reconciler.reconcileById(id);
    const recreate = this.runtimePreparation.shouldRecreateContainerOnUpdate(
      app,
      dto,
    );

    if (dto.name !== undefined) app.name = dto.name;
    if (dto.inactivityTimeoutSeconds !== undefined) {
      app.inactivityTimeoutSeconds = dto.inactivityTimeoutSeconds;
    }
    if (dto.memoryLimitMb !== undefined) app.memoryLimitMb = dto.memoryLimitMb;
    if (dto.cpuLimitCpus !== undefined) app.cpuLimitCpus = dto.cpuLimitCpus;
    if (dto.containerArgs !== undefined) {
      app.containerArgs = applyRedroidDefaultContainerArgs(
        app.containerImage,
        dto.containerArgs,
        app.runtimeKind,
      );
    }
    if (recreate) {
      await this.runtimePreparation.markContainerForRecreation(app);
    }
    return this.writer.saveAndDecorate(app);
  }

  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.reconciler.reconcileById(id);
    this.assertMutable(app);
    await this.runtimePreparation.switchProfile(app, dto);
    return this.writer.saveAndDecorate(app);
  }

  async deleteSavedProfile(id: string, profileName: string) {
    const app = await this.reconciler.reconcileById(id);
    await this.runtimePreparation.deleteSavedPersistentProfile(
      app,
      profileName,
    );
    return this.queries.decorate(app);
  }

  async updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    const app = await this.reconciler.reconcileById(id);
    this.assertMutable(app);
    const uploadedApk = await this.apks.get(dto.uploadedApkId);
    this.applicationFactory.applyUploadedApk(app, uploadedApk);
    await this.writer.save(app);

    if (app.status !== AndroidApplicationStatus.Running) {
      return this.queries.decorate(app);
    }

    await this.apkInstall.begin(
      app,
      'Installing updated APK. Viewer is available while installation finishes.',
    );
    return this.queries.getStored(id);
  }

  private assertMutable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException('Removed applications cannot be updated.');
    }
  }
}

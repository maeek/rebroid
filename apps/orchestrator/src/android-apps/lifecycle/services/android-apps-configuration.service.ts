import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { KeyedSerialQueue } from '../../../common/keyed-serial-queue';
import { resolveContainerImage } from '../../../common/container-image-reference';
import { RedroidRuntimeConfigService } from '../../../config/redroid-runtime-config.service';
import { applyRedroidDefaultContainerArgs } from '@rebroid/android-application-core/redroid-runtime';
import {
  APK_CATALOG,
  type ApkCatalogPort,
  type UploadedApkReference,
} from '../../../apk/contracts/apk-catalog.port';
import { SettingsService } from '../../../settings/settings.service';
import { AndroidApplication } from '../../android-application.entity';
import { CloneAndroidApplicationDto } from '../../common/dto/clone-android-application.dto';
import { CreateAndroidApplicationDto } from '../../common/dto/create-android-application.dto';
import { UpdateAndroidApplicationDto } from '../../common/dto/update-android-application.dto';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppsApkInstallLifecycleService } from '../../provisioning/services/android-apps-apk-install-lifecycle.service';
import { AndroidAppsProvisioningService } from '../../provisioning/services/android-apps-provisioning.service';
import { AndroidApplicationFactory } from './android-application.factory';
import { AndroidAppsRuntimePreparationService } from './android-apps-runtime-preparation.service';
import { AndroidRuntimeImageResolverService } from './android-runtime-image-resolver.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';
import { SwitchApplicationProfileDto } from '../dto/switch-application-profile.dto';
import { UpdateAndroidApplicationApkDto } from '../dto/update-android-application-apk.dto';
import { FeatureFlagsService } from '../../../feature-flags/feature-flags.service';
import {
  assertApplicationImageAccess,
  type ApplicationImageAccess,
} from '../utils/application-image-access';
import {
  assertAppNameAvailable,
  availableCloneName,
  appNameKey,
} from '../utils/application-names';

type ApplicationSettings = Awaited<ReturnType<SettingsService['getSettings']>>;

const unavailableApk = () =>
  new ConflictException({
    statusCode: 409,
    code: 'apk_unavailable',
    message: 'The uploaded APK is unavailable for this app.',
  });

@Injectable()
export class AndroidAppsConfigurationService {
  private readonly ownerConfiguration = new KeyedSerialQueue<string | null>();

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
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly writer: AndroidAppsStateWriter,
    private readonly features: FeatureFlagsService,
    private readonly redroidConfig: RedroidRuntimeConfigService,
  ) {}

  async create(
    dto: CreateAndroidApplicationDto,
    maxOpenApps?: number,
    imageAccess: ApplicationImageAccess = 'admin',
  ) {
    if (dto.networkPolicyEnabled !== false) {
      this.features.assertEnabled('feature.firewall');
    }
    const settings = await this.settings.getSettings();
    const containerImage = resolveContainerImage(
      dto.containerImage ?? settings.defaultContainerImage,
      settings.dockerImageRegistry,
    );
    assertApplicationImageAccess(
      containerImage,
      imageAccess,
      this.redroidConfig.privileged,
    );
    const ownerUserId = dto.ownerUserId?.trim() || null;
    const name = dto.name.trim();
    return this.ownerConfiguration.run(ownerUserId, async () => {
      assertAppNameAvailable(name, await this.ownerNameKeys(ownerUserId));
      const provision = (apk: UploadedApkReference | null) =>
        this.provision(
          { ...dto, name },
          settings,
          containerImage,
          apk,
          maxOpenApps,
        );
      if (!dto.uploadedApkId) return provision(null);
      let admitted = false;
      try {
        return await this.apks.withReference(dto.uploadedApkId, (apk) => {
          if (apk.ownerUserId !== ownerUserId) throw unavailableApk();
          admitted = true;
          return provision(apk);
        });
      } catch (error) {
        if (!admitted && error instanceof ConflictException)
          throw unavailableApk();
        throw error;
      }
    });
  }

  private async provision(
    dto: CreateAndroidApplicationDto,
    settings: ApplicationSettings,
    containerImage: string,
    uploadedApk: UploadedApkReference | null,
    maxOpenApps?: number,
  ) {
    const runtimeKind = await this.runtimeImages.resolveKind(containerImage);
    const app = this.applications.create(
      this.applicationFactory.initialFields(
        dto,
        settings,
        containerImage,
        runtimeKind,
      ),
    );

    app.id = randomUUID();
    this.applicationFactory.assignGeneratedNames(app);
    if (uploadedApk) {
      this.applicationFactory.applyUploadedApk(app, uploadedApk);
    }
    await this.backgroundJobs.submit(
      this.transitions.createProvisionJob(app, maxOpenApps),
      (reservation) => this.provisioning.provision(reservation),
    );
    await this.logs.append(app.id, 'Application record created', {
      name: app.name,
      ownerUserId: app.ownerUserId,
      image: app.containerImage,
      hasApk: Boolean(uploadedApk),
    });

    return this.queries.decorate(app);
  }

  async clone(
    id: string,
    dto: CloneAndroidApplicationDto,
    maxOpenApps?: number,
    imageAccess: ApplicationImageAccess = 'admin',
  ) {
    this.features.assertEnabled('feature.firewall');
    const [source, settings] = await Promise.all([
      this.reconciler.reconcileById(id),
      this.settings.getSettings(),
    ]);
    const containerImage = resolveContainerImage(
      source.containerImage,
      settings.dockerImageRegistry,
    );
    assertApplicationImageAccess(
      containerImage,
      imageAccess,
      this.redroidConfig.privileged,
    );
    const ownerUserId = dto.ownerUserId?.trim() || null;
    return this.ownerConfiguration.run(ownerUserId, async () => {
      const names = await this.ownerNameKeys(ownerUserId);
      const name = dto.name?.trim() ?? availableCloneName(source.name, names);
      assertAppNameAvailable(name, names);
      const uploadedApk = source.uploadedApkId
        ? await this.apks.cloneForOwner(source.uploadedApkId, ownerUserId)
        : null;
      const provision = (apk: UploadedApkReference | null) =>
        this.provision(
          {
            name,
            ownerUserId: ownerUserId ?? undefined,
            inactivityTimeoutSeconds: source.inactivityTimeoutSeconds,
            memoryLimitMb: source.memoryLimitMb ?? undefined,
            cpuLimitCpus: source.cpuLimitCpus ?? undefined,
            containerArgs: source.containerArgs ?? undefined,
          },
          settings,
          containerImage,
          apk,
          maxOpenApps,
        );
      return uploadedApk
        ? this.apks.withReference(uploadedApk.id, provision)
        : provision(null);
    });
  }

  async update(id: string, dto: UpdateAndroidApplicationDto) {
    const { ownerUserId } = await this.queries.getStored(id);
    return this.ownerConfiguration.run(ownerUserId, () =>
      this.updateConfiguration(id, dto),
    );
  }

  private async updateConfiguration(
    id: string,
    dto: UpdateAndroidApplicationDto,
  ) {
    const stored = await this.queries.getStored(id);
    const name = dto.name?.trim();
    const renamed = name !== undefined && name !== stored.name;
    if (renamed) {
      if (name.length < 2) throw new BadRequestException({ fields: ['name'] });
      if (appNameKey(name) !== appNameKey(stored.name)) {
        assertAppNameAvailable(
          name,
          await this.ownerNameKeys(stored.ownerUserId, id),
        );
      }
    }
    const saved = await this.transitions.updateConfiguration(id, (app) => {
      const containerArgs =
        dto.containerArgs === undefined
          ? undefined
          : applyRedroidDefaultContainerArgs(
              app.containerImage,
              dto.containerArgs,
              app.runtimeKind,
            );
      const recreate = this.runtimePreparation.shouldRecreateContainerOnUpdate(
        app,
        { ...dto, containerArgs },
      );
      return {
        name: renamed ? name : undefined,
        inactivityTimeoutSeconds: dto.inactivityTimeoutSeconds,
        memoryLimitMb: dto.memoryLimitMb,
        cpuLimitCpus: dto.cpuLimitCpus,
        containerArgs,
        recreateContainerOnNextStart:
          recreate &&
          (app.containerId ||
            app.status === AndroidApplicationStatus.Provisioning)
            ? true
            : undefined,
      };
    });
    return this.queries.decorate(saved);
  }

  private async ownerNameKeys(ownerUserId: string | null, exceptId?: string) {
    const apps = await this.applications.findOwnerAppNames(ownerUserId);
    return new Set(
      apps
        .filter((app) => app.id !== exceptId)
        .map((app) => appNameKey(app.name)),
    );
  }

  async switchProfile(id: string, dto: SwitchApplicationProfileDto) {
    const app = await this.reconciler.reconcileById(id);
    this.assertMutable(app);
    await this.assertRuntimeNotRecreating(app);
    if (this.backgroundJobs.hasWork(id)) {
      throw new ConflictException(
        'Wait for the active application job before switching profiles.',
      );
    }
    await this.runtimePreparation.switchProfile(app, dto);
    return this.writer.saveRuntimeReplacement(app);
  }

  async deleteSavedProfile(id: string, profileName: string) {
    const app = await this.reconciler.reconcileById(id);
    await this.assertRuntimeNotRecreating(app);
    await this.runtimePreparation.deleteSavedPersistentProfile(
      app,
      profileName,
    );
    return this.queries.decorate(app);
  }

  async updateApk(id: string, dto: UpdateAndroidApplicationApkDto) {
    const current = await this.reconciler.reconcileById(id);
    this.assertMutable(current);
    const app = await this.apks.withReference(
      dto.uploadedApkId,
      async (uploadedApk) => {
        if (uploadedApk.ownerUserId !== current.ownerUserId) {
          throw new ConflictException(
            'Uploaded APK does not belong to this application owner.',
          );
        }
        if (this.backgroundJobs.hasWork(id)) {
          throw new ConflictException(
            'Wait for the active application job before changing the attached APK.',
          );
        }
        return this.transitions.updateConfiguration(id, (stored) => {
          this.applicationFactory.applyUploadedApk(stored, uploadedApk);
          const {
            uploadedApkId,
            apkFilePath,
            apkOriginalName,
            apkPackageName,
          } = stored;
          return {
            uploadedApkId,
            apkFilePath,
            apkOriginalName,
            apkPackageName,
          };
        });
      },
    );

    if (app.status !== AndroidApplicationStatus.Running) {
      return this.queries.decorate(app);
    }

    await this.apkInstall.begin(
      app,
      'Installing updated APK. Viewer is available while installation finishes.',
    );
    return this.queries.getStored(id);
  }

  private assertRuntimeNotRecreating(app: AndroidApplication) {
    return this.transitions.assertNoRecreation(app.id);
  }

  private assertMutable(app: AndroidApplication) {
    if (app.status === AndroidApplicationStatus.Removed) {
      throw new ConflictException('Removed applications cannot be updated.');
    }
  }
}

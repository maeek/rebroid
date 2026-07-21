import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
import { ListAndroidApplicationsDto } from '../common/dto/list-android-applications.dto';
import type { AndroidAppsApkReferencesPort } from '../contracts/android-apps-apk-references.port';
import { AndroidApplicationStatus } from '../contracts/android-application-status';
import type {
  AndroidAppsRuntimeInventoryPort,
  NetworkPolicyTarget,
} from '../contracts/android-apps-runtime-inventory.port';

@Injectable()
export class AndroidApplicationsRepository
  implements AndroidAppsApkReferencesPort, AndroidAppsRuntimeInventoryPort
{
  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
  ) {}

  create(values: Partial<AndroidApplication>) {
    return this.applications.create(values);
  }

  save(app: AndroidApplication) {
    return this.applications.save(app);
  }

  remove(app: AndroidApplication) {
    return this.applications.remove(app);
  }

  updateLifecycle(
    applicationId: string,
    patch: Partial<
      Pick<
        AndroidApplication,
        | 'status'
        | 'lifecycleStage'
        | 'statusMessage'
        | 'lastError'
        | 'provisioningStartedAt'
        | 'provisioningCompletedAt'
        | 'removeDataOnRemoval'
      >
    >,
  ) {
    return this.applications.update(applicationId, patch);
  }

  updateApkPackageName(applicationId: string, apkPackageName: string) {
    return this.applications.update(applicationId, { apkPackageName });
  }

  updateContainerReference(
    applicationId: string,
    containerId: string,
    recreateContainerOnNextStart: boolean,
  ) {
    return this.applications.update(applicationId, {
      containerId,
      recreateContainerOnNextStart,
    });
  }

  updateNetworkPolicyState(
    applicationId: string,
    patch: Pick<
      AndroidApplication,
      'networkPolicyStatus' | 'networkPolicyMessage' | 'networkPolicyAppliedAt'
    > &
      Partial<Pick<AndroidApplication, 'lastStartedAt'>>,
  ) {
    return this.applications.update(applicationId, patch);
  }

  findForList(query: ListAndroidApplicationsDto) {
    return this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.applications.find();
  }

  findById(id: string) {
    return this.applications.findOneBy({ id });
  }

  findByStatus(status: AndroidApplicationStatus) {
    return this.applications.findBy({ status });
  }

  async findExistingIds(ids: string[]) {
    if (!ids.length) {
      return new Set<string>();
    }

    const applications = await this.applications.find({
      select: { id: true },
      where: { id: In(ids) },
    });
    return new Set(applications.map((app) => app.id));
  }

  async findRunningNetworkPolicyTargets(): Promise<NetworkPolicyTarget[]> {
    const applications = await this.applications.find({
      select: {
        id: true,
        containerId: true,
        networkName: true,
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: true,
      },
      where: {
        status: AndroidApplicationStatus.Running,
        networkPolicyEnabled: true,
      },
    });
    return applications.map((app) => ({
      id: app.id,
      containerId: app.containerId,
      networkName: app.networkName,
      networkPolicyEnabled: app.networkPolicyEnabled,
      networkPolicyAllowCidrs: app.networkPolicyAllowCidrs,
    }));
  }

  countUsingUploadedApk(uploadedApkId: string) {
    return this.applications.countBy({ uploadedApkId });
  }

  async findReferencedUploadedApkIds(uploadedApkIds: string[]) {
    if (!uploadedApkIds.length) {
      return new Set<string>();
    }

    const applications = await this.applications.find({
      select: { uploadedApkId: true },
      where: { uploadedApkId: In(uploadedApkIds) },
    });
    return new Set(
      applications
        .map((app) => app.uploadedApkId)
        .filter((id): id is string => Boolean(id)),
    );
  }
}

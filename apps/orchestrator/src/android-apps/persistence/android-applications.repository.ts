import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Or, Repository } from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
import { ListAndroidApplicationsDto } from '../common/dto/list-android-applications.dto';
import type { AndroidAppsApkReferencesPort } from '../contracts/android-apps-apk-references.port';
import { AndroidApplicationStatus } from '../contracts/android-application-status';
import type {
  AndroidAppsRuntimeInventoryPort,
  NetworkPolicyTarget,
} from '../contracts/android-apps-runtime-inventory.port';

type ViewerRuntime = Pick<
  AndroidApplication,
  'id' | 'containerId' | 'lastStartedAt'
>;
type NetworkPolicyState = Pick<
  AndroidApplication,
  'networkPolicyStatus' | 'networkPolicyMessage' | 'networkPolicyAppliedAt'
>;

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

  updateReconciledRuntime(
    previous: AndroidApplication,
    next: AndroidApplication,
  ) {
    return this.applications.update(
      {
        id: previous.id,
        status: previous.status,
        lifecycleStage: previous.lifecycleStage,
        containerId: previous.containerId ?? IsNull(),
      },
      {
        status: next.status,
        lifecycleStage: next.lifecycleStage,
        statusMessage: next.statusMessage,
        lastError: next.lastError,
        containerId: next.containerId,
        lastStartedAt: next.lastStartedAt,
        lastStoppedAt: next.lastStoppedAt,
      },
    );
  }

  updateNetworkPolicyState(
    applicationId: string,
    patch: NetworkPolicyState &
      Partial<Pick<AndroidApplication, 'lastStartedAt'>>,
  ) {
    return this.applications.update(applicationId, patch);
  }

  updateViewerActivity(runtime: ViewerRuntime, observedAt: Date) {
    return this.applications.update(
      {
        ...this.runningViewerRuntime(runtime),
        lastScrcpyActivityAt: Or(IsNull(), LessThan(observedAt)),
      },
      { lastScrcpyActivityAt: observedAt },
    );
  }

  updateViewerNetworkPolicyState(
    runtime: ViewerRuntime &
      Pick<
        AndroidApplication,
        'networkPolicyEnabled' | 'networkPolicyAllowCidrs'
      >,
    patch: NetworkPolicyState,
  ) {
    return this.applications.update(
      {
        ...this.runningViewerRuntime(runtime),
        networkPolicyEnabled: runtime.networkPolicyEnabled,
        networkPolicyAllowCidrs: runtime.networkPolicyAllowCidrs,
      },
      patch,
    );
  }

  private runningViewerRuntime(runtime: ViewerRuntime) {
    return {
      id: runtime.id,
      status: AndroidApplicationStatus.Running,
      containerId: runtime.containerId ?? IsNull(),
      lastStartedAt: runtime.lastStartedAt ?? IsNull(),
    };
  }

  updateNetworkPolicyConfiguration(
    applicationId: string,
    patch: Partial<
      Pick<
        AndroidApplication,
        'networkPolicyEnabled' | 'networkPolicyAllowCidrs'
      >
    >,
  ) {
    return this.applications.update(
      { id: applicationId, status: Not(AndroidApplicationStatus.Provisioning) },
      patch,
    );
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

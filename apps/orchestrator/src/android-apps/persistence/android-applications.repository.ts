import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Not,
  Or,
  Repository,
} from 'typeorm';
import { AndroidApplication } from '../android-application.entity';
import { ListAndroidApplicationSummariesDto } from '../common/dto/list-android-application-summaries.dto';
import { ListAndroidApplicationNavigationDto } from '../common/dto/list-android-application-navigation.dto';
import { ListAndroidApplicationsDto } from '../common/dto/list-android-applications.dto';
import type { AndroidRuntimeIdentity } from '../common/utils/android-runtime-identity';
import type { AndroidAppsApkReferencesPort } from '../contracts/android-apps-apk-references.port';
import { AndroidApplicationStatus } from '../contracts/android-application-status';
import type {
  AndroidAppsRuntimeInventoryPort,
  RestrictedRuntimePolicyTarget,
} from '../contracts/android-apps-runtime-inventory.port';

const applicationNavigationColumns = {
  id: true,
  kind: true,
  name: true,
  ownerUserId: true,
  status: true,
  lifecycleStage: true,
} as const;

type ViewerRuntime = Pick<
  AndroidApplication,
  'id' | 'containerId' | 'lastStartedAt'
>;
type NetworkPolicyState = Pick<
  AndroidApplication,
  'networkPolicyStatus' | 'networkPolicyMessage' | 'networkPolicyAppliedAt'
>;
export type RuntimePreparationFields = Pick<
  AndroidApplication,
  | 'containerArgs'
  | 'containerId'
  | 'lifecycleStage'
  | 'lastStoppedAt'
  | 'profileMode'
  | 'profileName'
  | 'provisioningCompletedAt'
  | 'recreateContainerOnNextStart'
  | 'savedProfilesJson'
  | 'status'
  | 'statusMessage'
  | 'volumeName'
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

  updateRuntimePreparation(
    id: string,
    changes: Partial<RuntimePreparationFields>,
  ) {
    return this.applications.update(
      {
        id,
        status: Not(
          In([
            AndroidApplicationStatus.Removing,
            AndroidApplicationStatus.Removed,
          ]),
        ),
      },
      changes,
    );
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
        lastStartedAt: previous.lastStartedAt ?? IsNull(),
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

  findOwnedViewerActivityRuntime(id: string, ownerUserId: string) {
    return this.applications.findOne({
      where: { id, ownerUserId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        containerId: true,
        lastStartedAt: true,
        lastScrcpyActivityAt: true,
      },
    });
  }

  updateViewerActivity(
    runtime: ViewerRuntime,
    observedAt: Date,
    ownerUserId?: string,
  ) {
    return this.applications.update(
      {
        ...this.runningViewerRuntime(runtime),
        ...(ownerUserId !== undefined && { ownerUserId }),
        lastScrcpyActivityAt: Or(IsNull(), LessThan(observedAt)),
      },
      { lastScrcpyActivityAt: observedAt },
    );
  }

  updateViewerNetworkPolicyState(
    runtime: ViewerRuntime &
      Pick<
        AndroidApplication,
        | 'networkPolicyEnabled'
        | 'networkPolicyAllowCidrs'
        | 'networkPolicyRevision'
        | 'networkName'
      >,
    patch: NetworkPolicyState,
  ) {
    return this.applications.update(
      {
        ...this.runningViewerRuntime(runtime),
        networkPolicyEnabled: runtime.networkPolicyEnabled,
        networkPolicyAllowCidrs: runtime.networkPolicyAllowCidrs,
        networkPolicyRevision: runtime.networkPolicyRevision,
        networkName: runtime.networkName,
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
      {
        ...patch,
        networkPolicyRevision: () => '"networkPolicyRevision" + 1',
        networkPolicyStatus: null,
        networkPolicyMessage: null,
        networkPolicyAppliedAt: null,
      },
    );
  }

  findForList(query: ListAndroidApplicationsDto) {
    return this.applications.find({
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  findOwnedRunningSnapshotTargets(): Promise<AndroidRuntimeIdentity[]> {
    return this.applications.find({
      select: {
        id: true,
        ownerUserId: true,
        containerId: true,
        lastStartedAt: true,
        profileMode: true,
        profileName: true,
        containerName: true,
        networkName: true,
        adbPort: true,
      },
      where: {
        status: AndroidApplicationStatus.Running,
        ownerUserId: Not(IsNull()),
        containerId: Not(IsNull()),
      },
    });
  }

  findRunningWithInactivityTimeout() {
    return this.applications.find({
      select: {
        id: true,
        containerId: true,
        lastStartedAt: true,
        lastScrcpyActivityAt: true,
        inactivityTimeoutSeconds: true,
      },
      where: {
        status: AndroidApplicationStatus.Running,
        inactivityTimeoutSeconds: MoreThanOrEqual(0),
      },
    });
  }

  findForGallery(query: ListAndroidApplicationsDto) {
    return this.applications.find({
      select: {
        ...applicationNavigationColumns,
        containerImage: true,
        apkPackageName: true,
        updatedAt: true,
      },
      where: query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  findForNavigation(query: ListAndroidApplicationNavigationDto) {
    const owner = query.ownerUserId ? { ownerUserId: query.ownerUserId } : {};
    const candidates = [];
    if (query.applicationIds.length) {
      const excluded = new Set(query.excludeIds);
      const ids = query.applicationIds.filter((id) => !excluded.has(id));
      if (ids.length) candidates.push({ ...owner, id: In(ids) });
    }
    if (query.includeRunning) {
      candidates.push({
        ...owner,
        status: AndroidApplicationStatus.Running,
        ...(query.excludeIds?.length && { id: Not(In(query.excludeIds)) }),
      });
    }
    if (!candidates.length) return Promise.resolve([]);
    return this.applications.find({
      select: applicationNavigationColumns,
      where: candidates,
    });
  }

  findForSummaries(query: ListAndroidApplicationSummariesDto) {
    const owner = query.ownerUserId ? { ownerUserId: query.ownerUserId } : {};
    const candidates = [];
    if (query.applicationIds?.length) {
      candidates.push({ ...owner, id: In(query.applicationIds) });
    }
    if (query.includeRunning) {
      candidates.push({ ...owner, status: AndroidApplicationStatus.Running });
    }

    return this.applications.find({
      select: {
        id: true,
        kind: true,
        name: true,
        ownerUserId: true,
        status: true,
        lifecycleStage: true,
        apkPackageName: true,
        statusMessage: true,
        lastError: true,
        containerImage: true,
        containerArgs: true,
        containerName: true,
        volumeName: true,
        networkName: true,
        recreateContainerOnNextStart: true,
        provisioningStartedAt: true,
        provisioningCompletedAt: true,
        lastStartedAt: true,
      },
      where: candidates.length ? candidates : owner,
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.applications.find();
  }

  findById(id: string) {
    return this.applications.findOneBy({ id });
  }

  findViewerRuntime(id: string) {
    return this.applications.findOne({
      where: { id },
      select: {
        id: true,
        kind: true,
        ownerUserId: true,
        status: true,
        containerId: true,
      },
    });
  }

  findOwnerAppNames(ownerUserId: string | null) {
    return this.applications.find({
      select: { id: true, name: true },
      where: { ownerUserId: ownerUserId ?? IsNull() },
    });
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

  async findRestrictedRuntimePolicyTargets(
    applicationIds?: string[],
  ): Promise<RestrictedRuntimePolicyTarget[]> {
    const applications = await this.applications.find({
      select: {
        id: true,
        containerId: true,
        networkName: true,
        networkPolicyEnabled: true,
        networkPolicyAllowCidrs: true,
        networkPolicyRevision: true,
      },
      where: {
        ...(applicationIds ? { id: In(applicationIds) } : {}),
        containerId: Not(IsNull()),
        networkPolicyEnabled: true,
      },
    });
    return applications.flatMap((app) =>
      app.containerId === null
        ? []
        : [
            {
              id: app.id,
              containerId: app.containerId,
              networkName: app.networkName,
              networkPolicyEnabled: app.networkPolicyEnabled,
              networkPolicyAllowCidrs: app.networkPolicyAllowCidrs,
              networkPolicyRevision: app.networkPolicyRevision,
            },
          ],
    );
  }

  countUsingUploadedApk(uploadedApkId: string) {
    return this.applications.countBy({ uploadedApkId });
  }

  listUploadedApkReferences() {
    return this.applications.find({
      select: { id: true, name: true, uploadedApkId: true },
      where: { uploadedApkId: Not(IsNull()) },
    });
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

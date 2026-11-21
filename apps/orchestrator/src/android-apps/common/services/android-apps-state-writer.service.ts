import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppRuntimeSnapshotsRepository } from '../../persistence/android-app-runtime-snapshots.repository';
import { viewerActivityRuntimeKey } from '../utils/android-runtime-identity';
import { AndroidAppsStatusService } from './android-apps-status.service';

export type AndroidApplicationLifecyclePatch = Partial<
  Pick<
    AndroidApplication,
    | 'status'
    | 'lifecycleStage'
    | 'statusMessage'
    | 'lastError'
    | 'provisioningStartedAt'
    | 'provisioningCompletedAt'
    | 'lastStoppedAt'
    | 'removeDataOnRemoval'
    | 'containerId'
    | 'appliedRendering'
    | 'recreateContainerOnNextStart'
  >
>;

@Injectable()
export class AndroidAppsStateWriter {
  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly status: AndroidAppsStatusService,
    private readonly snapshots: AndroidAppRuntimeSnapshotsRepository,
  ) {}

  save(app: AndroidApplication) {
    return this.applications.save(app);
  }

  async saveAndDecorate(app: AndroidApplication, updateName = false) {
    const saved = await this.applications.save(app, updateName);
    return this.status.decorateApplication(saved);
  }

  async saveRuntimeReplacement(app: AndroidApplication) {
    const saved = await this.saveAndDecorate(app);
    await this.snapshots.deleteIfStale(app.id);
    return saved;
  }

  async saveReconciledRuntime(
    previous: AndroidApplication,
    next: AndroidApplication,
  ) {
    const result = await this.applications.updateReconciledRuntime(
      previous,
      next,
    );
    if (result.affected !== 1) return false;
    if (
      previous.status === AndroidApplicationStatus.Running &&
      (next.status !== AndroidApplicationStatus.Running ||
        next.containerId !== previous.containerId)
    ) {
      await this.snapshots.deleteIfStale(next.id);
    }
    return true;
  }

  async setApkPackageName(applicationId: string, apkPackageName: string) {
    await this.applications.updateApkPackageName(applicationId, apkPackageName);
  }

  async setNetworkPolicyState(
    applicationId: string,
    patch: Parameters<
      AndroidApplicationsRepository['updateNetworkPolicyState']
    >[1],
  ) {
    await this.applications.updateNetworkPolicyState(applicationId, patch);
  }

  async recordViewerActivity(app: AndroidApplication) {
    const observedAt = new Date();
    await this.applications.updateViewerActivity(app, observedAt);
    return observedAt;
  }

  async recordOwnedViewerActivity(
    id: string,
    ownerUserId: string,
    runtimeKey: string,
  ) {
    const requireRuntime = async () => {
      const runtime = await this.applications.findOwnedViewerActivityRuntime(
        id,
        ownerUserId,
      );
      if (!runtime)
        throw new ForbiddenException(
          'Viewer activity requires application ownership.',
        );
      if (
        runtime.status !== AndroidApplicationStatus.Running ||
        !runtime.containerId ||
        viewerActivityRuntimeKey(runtime) !== runtimeKey
      ) {
        throw new ConflictException(
          'The display session runtime is no longer current.',
        );
      }
      return runtime;
    };

    const runtime = await requireRuntime();
    const observedAt = new Date();
    const result = await this.applications.updateViewerActivity(
      runtime,
      observedAt,
      ownerUserId,
    );
    if (result.affected === 1) return observedAt;
    const current = await requireRuntime();
    // A concurrent heartbeat may already have recorded the same or a later time.
    return current.lastScrcpyActivityAt ?? observedAt;
  }

  async recordViewerNetworkPolicy(
    app: AndroidApplication,
    result: {
      status: AndroidApplication['networkPolicyStatus'];
      message: string;
    },
  ) {
    const update = await this.applications.updateViewerNetworkPolicyState(app, {
      networkPolicyStatus: result.status,
      networkPolicyMessage: result.message,
      networkPolicyAppliedAt: new Date(),
    });
    return update.affected === 1;
  }

  async saveNetworkPolicyConfiguration(
    applicationId: string,
    patch: Parameters<
      AndroidApplicationsRepository['updateNetworkPolicyConfiguration']
    >[1],
  ) {
    const result = await this.applications.updateNetworkPolicyConfiguration(
      applicationId,
      patch,
    );
    return result.affected === 1;
  }
}

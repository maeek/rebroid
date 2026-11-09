import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
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
    | 'removeDataOnRemoval'
    | 'containerId'
    | 'recreateContainerOnNextStart'
  >
>;

@Injectable()
export class AndroidAppsStateWriter {
  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly status: AndroidAppsStatusService,
  ) {}

  save(app: AndroidApplication) {
    return this.applications.save(app);
  }

  async saveAndDecorate(app: AndroidApplication) {
    const saved = await this.applications.save(app);
    return this.status.decorateApplication(saved);
  }

  async saveReconciledRuntime(
    previous: AndroidApplication,
    next: AndroidApplication,
  ) {
    const result = await this.applications.updateReconciledRuntime(
      previous,
      next,
    );
    return result.affected === 1;
  }

  async setLifecycle(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    await this.applications.updateLifecycle(applicationId, patch);
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

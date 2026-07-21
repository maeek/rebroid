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

  async setLifecycle(
    applicationId: string,
    patch: AndroidApplicationLifecyclePatch,
  ) {
    await this.applications.updateLifecycle(applicationId, patch);
  }

  async setApkPackageName(applicationId: string, apkPackageName: string) {
    await this.applications.updateApkPackageName(applicationId, apkPackageName);
  }

  async setContainerReference(
    applicationId: string,
    containerId: string,
    recreateContainerOnNextStart: boolean,
  ) {
    await this.applications.updateContainerReference(
      applicationId,
      containerId,
      recreateContainerOnNextStart,
    );
  }

  async setNetworkPolicyState(
    applicationId: string,
    patch: Parameters<
      AndroidApplicationsRepository['updateNetworkPolicyState']
    >[1],
  ) {
    await this.applications.updateNetworkPolicyState(applicationId, patch);
  }
}

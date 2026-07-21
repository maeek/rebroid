import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { RemoveAndroidApplicationDto } from '../../common/dto/remove-android-application.dto';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppLifecycleJobKind } from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from './android-app-lifecycle-jobs.service';
import { AndroidAppsRemovalCleanupService } from './android-apps-removal-cleanup.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

const REMOVAL_ATTEMPTS = 12;
const REMOVAL_RETRY_DELAY_MS = 5_000;

@Injectable()
export class AndroidAppsRemovalService {
  private readonly logger = new Logger(AndroidAppsRemovalService.name);

  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
    private readonly cleanup: AndroidAppsRemovalCleanupService,
    private readonly jobs: AndroidAppLifecycleJobsService,
    private readonly logs: AndroidAppsLogService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
  ) {}

  async request(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.reconciler.reconcileById(id);
    const removeData = query.removeData ?? true;
    this.tracker.cancel(id);
    await this.transitions.beginJob(
      id,
      AndroidAppLifecycleJobKind.Remove,
      {
        status: AndroidApplicationStatus.Removing,
        lifecycleStage: AndroidApplicationLifecycleStage.Removing,
        statusMessage: 'Removing application container and network resources.',
        removeDataOnRemoval: removeData,
      },
      { removeData },
      true,
    );
    await this.logs.append(id, 'Remove requested', {
      removeData,
      containerId: app.containerId,
      networkName: app.networkName,
      volumeName: app.volumeName,
    });
    app.removeDataOnRemoval = removeData;
    this.resume(app);

    return {
      id,
      deleted: false,
      cleanupQueued: true,
      removedData: removeData,
    };
  }

  resume(app: AndroidApplication) {
    this.backgroundJobs.schedule(`remove:${app.id}`, () =>
      this.removeInBackground(app),
    );
  }

  releaseDisplaySessionsInBackground(applicationId: string, operation: string) {
    this.cleanup.releaseDisplaySessionsInBackground(applicationId, operation);
  }

  private async removeInBackground(app: AndroidApplication) {
    await this.jobs.markRunning(app.id, AndroidAppLifecycleJobKind.Remove);
    for (let attempt = 1; attempt <= REMOVAL_ATTEMPTS; attempt += 1) {
      try {
        await this.cleanup.cleanup(app, app.removeDataOnRemoval);
        await this.applications.remove(app);
        await this.logs.remove(app.id);
        await this.jobs.complete(app.id, AndroidAppLifecycleJobKind.Remove);
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        this.logger.warn(
          `Removal cleanup attempt ${attempt}/${REMOVAL_ATTEMPTS} failed for ${app.id}: ${message}`,
        );
        if (attempt === REMOVAL_ATTEMPTS) {
          await this.transitions.failJob(
            app.id,
            AndroidAppLifecycleJobKind.Remove,
            message,
            {
              status: AndroidApplicationStatus.Removing,
              lifecycleStage: AndroidApplicationLifecycleStage.Removing,
              statusMessage: `Removal cleanup paused: ${message}`,
              lastError: message,
            },
          );
          return;
        }
        await delay(REMOVAL_RETRY_DELAY_MS);
      }
    }
  }
}

import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from '../../common/services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJobKind,
  type AndroidAppLifecycleReservation,
} from '../../lifecycle/entities/android-app-lifecycle-job.entity';
import { LifecycleBackgroundJobRunner } from '../../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsProvisioningApkService } from './android-apps-provisioning-apk.service';

@Injectable()
export class AndroidAppsApkInstallLifecycleService {
  private readonly logger = new Logger(
    AndroidAppsApkInstallLifecycleService.name,
  );

  constructor(
    private readonly transitions: AndroidAppsLifecycleTransitionService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
    private readonly apkProvisioning: AndroidAppsProvisioningApkService,
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
  ) {}

  async begin(
    app: AndroidApplication,
    statusMessage: string,
    current?: AndroidAppLifecycleReservation,
  ) {
    this.tracker.ensureActive(app.id);
    const patch = {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
      lastError: null,
    };
    if (current?.kind === AndroidAppLifecycleJobKind.Recreate) {
      // Keep Recreate reserved and recoverable as a Recreate until APK preparation finishes.
      if (!(await this.transitions.updateProgress(current, patch))) {
        throw new ConflictException(
          `Application "${app.id}" no longer owns the Recreate reservation.`,
        );
      }
      Object.assign(app, patch);
      await this.installAndComplete(app, current);
      return;
    }

    const reservation = current
      ? await this.transitions.handoffJob(
          current,
          AndroidAppLifecycleJobKind.InstallApk,
          patch,
        )
      : await this.transitions.beginJob(
          app.id,
          AndroidAppLifecycleJobKind.InstallApk,
          patch,
        );
    if (!reservation) {
      throw new ConflictException(
        `Application "${app.id}" no longer owns the expected lifecycle job.`,
      );
    }

    Object.assign(app, patch);
    this.resume(reservation);
  }

  resume(reservation: AndroidAppLifecycleReservation) {
    this.backgroundJobs.schedule(reservation, () =>
      this.completeInBackground(reservation),
    );
  }

  private async completeInBackground(
    reservation: AndroidAppLifecycleReservation,
  ) {
    const { applicationId } = reservation;
    if (!(await this.transitions.claimJob(reservation))) return;
    try {
      const app = await this.queries.getStored(applicationId);
      await this.installAndComplete(app, reservation);
    } catch (error) {
      if (this.tracker.isCancelled(applicationId)) {
        this.logger.log(
          `Background APK install cancelled for ${applicationId}.`,
        );
        return;
      }

      const message = getErrorMessage(error);
      this.logger.error(
        `Background APK install failed for ${applicationId}: ${message}`,
      );
      await this.transitions.failJob(reservation, message, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: `APK install failed: ${message}`,
        lastError: message,
      });
      await this.logs.append(applicationId, 'Background APK install failed', {
        error: message,
      });
    }
  }

  private async installAndComplete(
    app: AndroidApplication,
    reservation: AndroidAppLifecycleReservation,
  ) {
    this.tracker.ensureActive(app.id);
    await this.apkProvisioning.installApk(app);
    await this.logs.append(app.id, 'Background APK install finished', {
      apkPackageName: app.apkPackageName,
    });
    this.tracker.ensureActive(app.id);
    await this.apkProvisioning.launchInstalledApk(app);
    this.tracker.ensureActive(app.id);
    await this.logs.append(app.id, 'Application marked running', {
      containerId: app.containerId,
    });
    await this.transitions.completeJob(reservation, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.Ready,
      statusMessage: 'Application is running.',
      lastError: null,
      provisioningCompletedAt: new Date(),
    });
  }
}

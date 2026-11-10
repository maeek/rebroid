import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { getErrorMessage } from '../../../common/error-message';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { RemoveAndroidApplicationDto } from '../../common/dto/remove-android-application.dto';
import { AndroidAppsLifecycleTransitionService } from '../../common/services/android-apps-lifecycle-transition.service';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import {
  AndroidAppLifecycleJobKind,
  type AndroidAppLifecycleReservation,
} from '../entities/android-app-lifecycle-job.entity';
import { AndroidAppsRemovalCleanupService } from './android-apps-removal-cleanup.service';
import { LifecycleBackgroundJobRunner } from './lifecycle-background-job-runner.service';

const REMOVAL_ATTEMPTS = 12;
const REMOVAL_RETRY_DELAY_MS = 5_000;

@Injectable()
export class AndroidAppsRemovalService {
  private readonly logger = new Logger(AndroidAppsRemovalService.name);

  constructor(
    private readonly backgroundJobs: LifecycleBackgroundJobRunner,
    private readonly cleanup: AndroidAppsRemovalCleanupService,
    private readonly logs: AndroidAppsLogService,
    private readonly queries: AndroidAppsQueryService,
    private readonly transitions: AndroidAppsLifecycleTransitionService,
  ) {}

  async request(id: string, query: RemoveAndroidApplicationDto) {
    const app = await this.queries.getStored(id);
    await this.transitions.assertNoRecreation(id);
    const removeData = query.removeData ?? true;
    if (
      app.status === AndroidApplicationStatus.Removing &&
      this.backgroundJobs.hasWork(id)
    ) {
      if (app.removeDataOnRemoval !== removeData) {
        throw new ConflictException(
          'Removal is already in progress with different data options.',
        );
      }
    } else {
      const reservation = await this.backgroundJobs.interrupt(id, () =>
        this.transitions.beginJob(
          id,
          AndroidAppLifecycleJobKind.Remove,
          {
            status: AndroidApplicationStatus.Removing,
            lifecycleStage: AndroidApplicationLifecycleStage.Removing,
            statusMessage:
              'Removing application container and network resources.',
            removeDataOnRemoval: removeData,
          },
          { removeData },
          true,
        ),
      );
      this.resume(reservation);
      await this.logs.append(id, 'Remove requested', {
        removeData,
        containerId: app.containerId,
        networkName: app.networkName,
        volumeName: app.volumeName,
      });
    }

    return {
      id,
      deleted: false,
      cleanupQueued: true,
      removedData: removeData,
    };
  }

  resume(reservation: AndroidAppLifecycleReservation) {
    this.backgroundJobs.schedule(reservation, () =>
      this.removeInBackground(reservation),
    );
  }

  private async removeInBackground(
    reservation: AndroidAppLifecycleReservation,
  ) {
    if (!(await this.transitions.claimJob(reservation))) return;
    const app = await this.queries.getStored(reservation.applicationId);
    for (let attempt = 1; attempt <= REMOVAL_ATTEMPTS; attempt += 1) {
      try {
        await this.cleanup.cleanup(app, app.removeDataOnRemoval);
        if (!(await this.transitions.completeRemoval(reservation))) return;
        await this.logs.remove(app.id).catch((error: unknown) => {
          this.logger.warn(
            `Could not remove lifecycle logs for ${app.id}: ${getErrorMessage(error)}`,
          );
        });
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        this.logger.warn(
          `Removal cleanup attempt ${attempt}/${REMOVAL_ATTEMPTS} failed for ${app.id}: ${message}`,
        );
        if (attempt === REMOVAL_ATTEMPTS) {
          await this.transitions.failJob(reservation, message, {
            status: AndroidApplicationStatus.Removing,
            lifecycleStage: AndroidApplicationLifecycleStage.Removing,
            statusMessage: `Removal cleanup paused: ${message}`,
            lastError: message,
          });
          return;
        }
        await delay(REMOVAL_RETRY_DELAY_MS);
      }
    }
  }
}

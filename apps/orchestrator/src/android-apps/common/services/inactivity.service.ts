import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AndroidAppsQueryService } from './android-apps-query.service';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { getErrorMessage } from '../../../common/error-message';
import { mapSettledWithConcurrency } from '../../../common/map-with-concurrency';

@Injectable()
export class InactivityService {
  private readonly logger = new Logger(InactivityService.name);

  constructor(
    private readonly queries: AndroidAppsQueryService,
    private readonly lifecycle: AndroidAppsLifecycleService,
  ) {}

  /**
   * Stops running apps that have been idle longer than their configured timeout.
   * Activity is based on scrcpy refreshes, not generic container noise.
   */
  // Offset the sweep from the minute-aligned runtime snapshot capture.
  @Cron('30 * * * * *', {
    name: 'android-apps-inactivity-stop',
    waitForCompletion: true,
  })
  async stopInactiveApplications() {
    const candidates = await this.queries.findInactiveRunningApplications();
    await mapSettledWithConcurrency(candidates, 4, async (candidate) => {
      try {
        await this.lifecycle.stopIfInactive(candidate);
      } catch (error) {
        this.logger.warn(
          `Could not stop inactive application ${candidate.id}: ${getErrorMessage(error)}`,
        );
      }
    });
  }
}

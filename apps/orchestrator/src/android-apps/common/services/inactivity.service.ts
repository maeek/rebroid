import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AndroidAppsService } from '../android-apps.service';

@Injectable()
export class InactivityService {
  private readonly logger = new Logger(InactivityService.name);

  constructor(private readonly androidApps: AndroidAppsService) {}

  /**
   * Stops running apps that have been idle longer than their configured timeout.
   * Activity is based on scrcpy refreshes, not generic container noise.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'android-apps-inactivity-stop',
    waitForCompletion: true,
  })
  async stopInactiveApplications() {
    const inactiveApplications =
      await this.androidApps.findInactiveRunningApplications();

    await Promise.allSettled(
      inactiveApplications.map(async (app) => {
        this.logger.log(
          `Stopping inactive application container ${app.containerName} for application ${app.id}.`,
        );
        await this.androidApps.stop(app.id, {
          reason: 'inactivity_timeout',
          details: {
            inactivityTimeoutSeconds: app.inactivityTimeoutSeconds,
            lastScrcpyActivityAt:
              app.lastScrcpyActivityAt?.toISOString() ?? null,
            lastStartedAt: app.lastStartedAt?.toISOString() ?? null,
          },
        });
      }),
    );
  }
}

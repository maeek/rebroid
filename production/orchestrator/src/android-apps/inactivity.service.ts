import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AndroidAppsService } from './android-apps.service';

@Injectable()
export class InactivityService {
  private readonly logger = new Logger(InactivityService.name);

  constructor(private readonly androidApps: AndroidAppsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async stopInactiveApplications() {
    const inactiveApplications =
      await this.androidApps.findInactiveRunningApplications();

    for (const app of inactiveApplications) {
      this.logger.log(
        `Stopping inactive application container ${app.containerName} for application ${app.id}.`,
      );
      await this.androidApps.stop(app.id);
    }
  }
}

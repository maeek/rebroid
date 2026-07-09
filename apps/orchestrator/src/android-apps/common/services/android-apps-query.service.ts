import { Injectable } from '@nestjs/common';
import { throwNotFound } from '../../../common/not-found';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { latestRuntimeActivity } from '../utils/android-apps-inactivity.utils';
import { AndroidAppsStatusService } from './android-apps-status.service';

@Injectable()
export class AndroidAppsQueryService {
  constructor(
    private readonly applications: AndroidApplicationsRepository,
    private readonly status: AndroidAppsStatusService,
  ) {}

  async listStored(query: ListAndroidApplicationsDto) {
    const apps = await this.listStoredEntities(query);
    return apps.map((app) => this.status.decorateApplication(app));
  }

  listSummaries(query: ListAndroidApplicationsDto) {
    return this.listStored(query);
  }

  listStoredEntities(query: ListAndroidApplicationsDto) {
    return this.applications.findForList(query);
  }

  async getStored(id: string) {
    return (
      (await this.applications.findById(id)) ?? throwNotFound('Application', id)
    );
  }

  decorate(app: AndroidApplication) {
    return this.status.decorateApplication(app);
  }

  async findInactiveRunningApplications(now = new Date()) {
    const running = await this.applications.findByStatus(
      AndroidApplicationStatus.Running,
    );

    return running.filter((app) => {
      if (app.inactivityTimeoutSeconds < 0) {
        return false;
      }

      const lastActivity = latestRuntimeActivity(
        app.lastScrcpyActivityAt,
        app.lastStartedAt,
      );
      if (!lastActivity) {
        return false;
      }

      const inactiveSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
      return inactiveSeconds >= app.inactivityTimeoutSeconds;
    });
  }
}

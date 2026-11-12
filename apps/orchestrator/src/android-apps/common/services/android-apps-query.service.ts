import { Injectable } from '@nestjs/common';
import { throwNotFound } from '../../../common/not-found';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { ListAndroidApplicationSummariesDto } from '../dto/list-android-application-summaries.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { deriveApplicationError } from '../utils/android-apps-error-status.utils';
import { latestRuntimeActivity } from '../utils/android-apps-inactivity.utils';
import { deriveStatusDetail } from '../utils/android-apps-status-detail.utils';
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

  async listSummaries(query: ListAndroidApplicationSummariesDto) {
    const apps = await this.applications.findForSummaries(query);
    return apps.map((app) => {
      app.applicationError = deriveApplicationError(app);
      app.statusDetail = deriveStatusDetail(app);
      return app;
    });
  }

  listStoredEntities(query: ListAndroidApplicationsDto) {
    return this.applications.findForList(query);
  }

  async getStored(id: string) {
    return (
      (await this.applications.findById(id)) ?? throwNotFound('Application', id)
    );
  }

  async getViewerRuntime(id: string) {
    return (
      (await this.applications.findViewerRuntime(id)) ??
      throwNotFound('Application', id)
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

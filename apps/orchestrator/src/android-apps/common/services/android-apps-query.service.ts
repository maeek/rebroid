import { BadRequestException, Injectable } from '@nestjs/common';
import { throwNotFound } from '../../../common/not-found';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import {
  AndroidApplicationDetailRefreshDto,
  AndroidApplicationDetailStateDto,
  AndroidApplicationResponseDto,
} from '../dto/android-application-response.dto';
import { ListAndroidApplicationSummariesDto } from '../dto/list-android-application-summaries.dto';
import { ListAndroidApplicationNavigationDto } from '../dto/list-android-application-navigation.dto';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { androidAppDetailRevision } from '../utils/android-app-detail-revision';
import { deriveApplicationError } from '../utils/android-apps-error-status.utils';
import {
  isRuntimeInactive,
  type InactivityCandidate,
} from '../utils/android-apps-inactivity.utils';
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

  listGallery(query: ListAndroidApplicationsDto) {
    return this.applications.findForGallery(query);
  }

  async listNavigation(query: ListAndroidApplicationNavigationDto) {
    const { runningLimit } = query;
    if (!runningLimit) return this.applications.findForNavigation(query);

    const recentIds = new Set(query.applicationIds);
    let collator: Intl.Collator;
    try {
      collator = new Intl.Collator(query.locale, {
        numeric: true,
        sensitivity: 'base',
      });
    } catch {
      throw new BadRequestException('Invalid application navigation locale.');
    }
    const compareNames = (
      left: AndroidApplication,
      right: AndroidApplication,
    ) =>
      collator.compare(left.name, right.name) ||
      left.id.localeCompare(right.id);
    const running: AndroidApplication[] = [];
    const recent: AndroidApplication[] = [];
    for (const row of await this.applications.findForNavigation(query)) {
      if (row.status === AndroidApplicationStatus.Running) {
        running.push(row);
        running.sort(compareNames);
        if (running.length > runningLimit) running.pop();
      }
      if (recentIds.has(row.id)) recent.push(row);
    }

    const preferredIds = new Set(running.map(({ id }) => id));
    return running.concat(recent.filter(({ id }) => !preferredIds.has(id)));
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

  async getDetail(id: string): Promise<AndroidApplicationResponseDto> {
    const app = await this.getStored(id);
    return this.presentDetail(app, androidAppDetailRevision(app));
  }

  async refreshDetail(
    id: string,
    knownRevision?: string,
  ): Promise<AndroidApplicationDetailRefreshDto> {
    const app = await this.getStored(id);
    const revision = androidAppDetailRevision(app);
    if (revision === knownRevision) {
      return {
        ownerUserId: app.ownerUserId,
        state: AndroidApplicationDetailStateDto.fromEntity(this.decorate(app)),
        app: null,
      };
    }
    return {
      ownerUserId: app.ownerUserId,
      state: null,
      app: this.presentDetail(app, revision),
    };
  }

  private presentDetail(app: AndroidApplication, detailRevision: string) {
    return {
      ...AndroidApplicationResponseDto.fromEntity(this.decorate(app)),
      detailRevision,
    };
  }

  listOwnedRunningSnapshotTargets() {
    return this.applications.findOwnedRunningSnapshotTargets();
  }

  async findInactiveRunningApplications(
    now = new Date(),
  ): Promise<InactivityCandidate[]> {
    const running = await this.applications.findRunningWithInactivityTimeout();
    return running
      .filter((app) => isRuntimeInactive(app, now))
      .map(({ id, containerId, lastStartedAt }) => ({
        id,
        containerId,
        lastStartedAt,
      }));
  }
}

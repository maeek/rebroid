import { Injectable } from '@nestjs/common';
import { AndroidApplication } from '../../android-application.entity';
import { ListAndroidApplicationsDto } from '../dto/list-android-applications.dto';
import { AndroidAppsQueryService } from './android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './android-apps-runtime-state-reconciler.service';
import {
  AndroidApplicationLifecyclePatch,
  AndroidAppsStateWriter,
} from './android-apps-state-writer.service';

/**
 * Compatibility facade for application services while stored reads and runtime
 * reconciliation migrate to their explicit collaborators.
 */
@Injectable()
export class AndroidAppsStateService {
  constructor(
    private readonly queries: AndroidAppsQueryService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly writer: AndroidAppsStateWriter,
  ) {}

  list(query: ListAndroidApplicationsDto) {
    return this.reconciler.reconcileMany(query);
  }

  listSummaries(query: ListAndroidApplicationsDto) {
    return this.queries.listSummaries(query);
  }

  get(id: string) {
    return this.reconciler.reconcileById(id);
  }

  getStored(id: string) {
    return this.queries.getStored(id);
  }

  decorateApplication(app: AndroidApplication) {
    return this.queries.decorate(app);
  }

  save(app: AndroidApplication) {
    return this.writer.save(app);
  }

  saveAndDecorate(app: AndroidApplication) {
    return this.writer.saveAndDecorate(app);
  }

  setLifecycle(applicationId: string, patch: AndroidApplicationLifecyclePatch) {
    return this.writer.setLifecycle(applicationId, patch);
  }

  clearMissingContainerReference(app: AndroidApplication) {
    return this.reconciler.clearMissingContainerReference(app);
  }

  findInactiveRunningApplications(now = new Date()) {
    return this.queries.findInactiveRunningApplications(now);
  }
}

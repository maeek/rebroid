import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { ANDROID_APPS_RUNTIME_LOG_MAINTENANCE } from '../contracts/android-apps-runtime-log-maintenance.port';
import { AndroidAppLifecycleJobsService } from '../lifecycle/services/android-app-lifecycle-jobs.service';
import { LifecycleBackgroundJobRunner } from '../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsLifecycleTransitionService } from './services/android-apps-lifecycle-transition.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from './services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from './services/android-apps-state-writer.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';

@Module({
  imports: [
    AppConfigModule,
    AndroidAppsPersistenceModule,
    DockerModule,
    NetworkPolicyModule,
  ],
  providers: [
    AndroidAppsLogService,
    {
      provide: ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
      useExisting: AndroidAppsLogService,
    },
    AndroidAppsLifecycleTransitionService,
    AndroidAppLifecycleJobsService,
    LifecycleBackgroundJobRunner,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
  exports: [
    AndroidAppsLogService,
    ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
    AndroidAppsLifecycleTransitionService,
    AndroidAppLifecycleJobsService,
    LifecycleBackgroundJobRunner,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
})
export class AndroidAppsCommonModule {}

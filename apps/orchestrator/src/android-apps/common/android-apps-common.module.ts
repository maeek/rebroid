import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { ANDROID_APPS_RUNTIME_LOG_MAINTENANCE } from '../contracts/android-apps-runtime-log-maintenance.port';
import { LifecycleBackgroundJobRunner } from '../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsPolicyGate } from './services/android-apps-policy-gate.service';
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
    AndroidAppsPolicyGate,
    {
      provide: ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
      useExisting: AndroidAppsLogService,
    },
    AndroidAppsLifecycleTransitionService,
    LifecycleBackgroundJobRunner,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
  exports: [
    AndroidAppsLogService,
    AndroidAppsPolicyGate,
    ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
    AndroidAppsLifecycleTransitionService,
    LifecycleBackgroundJobRunner,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
})
export class AndroidAppsCommonModule {}

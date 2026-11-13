import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { ANDROID_APPS_RUNTIME_LOG_MAINTENANCE } from '../contracts/android-apps-runtime-log-maintenance.port';
import { LifecycleBackgroundJobRunner } from '../lifecycle/services/lifecycle-background-job-runner.service';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsPolicyGate } from './services/android-apps-policy-gate.service';
import { AndroidAppsRuntimeOperationGate } from './services/android-apps-runtime-operation-gate.service';
import { AndroidAppsLifecycleTransitionService } from './services/android-apps-lifecycle-transition.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from './services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from './services/android-apps-state-writer.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';
import { AndroidAppsTcpAdbService } from './services/android-apps-tcp-adb.service';

@Module({
  imports: [
    FeatureFlagsModule,
    AppConfigModule,
    AndroidAppsPersistenceModule,
    DockerModule,
    NetworkPolicyModule,
  ],
  providers: [
    AndroidAppsLogService,
    AndroidAppsPolicyGate,
    AndroidAppsRuntimeOperationGate,
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
    AndroidAppsTcpAdbService,
  ],
  exports: [
    AndroidAppsLogService,
    AndroidAppsPolicyGate,
    AndroidAppsRuntimeOperationGate,
    ANDROID_APPS_RUNTIME_LOG_MAINTENANCE,
    AndroidAppsLifecycleTransitionService,
    LifecycleBackgroundJobRunner,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
    AndroidAppsTcpAdbService,
  ],
})
export class AndroidAppsCommonModule {}

import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { AndroidAppLifecycleJobsService } from '../lifecycle/services/android-app-lifecycle-jobs.service';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsQueryService } from './services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from './services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from './services/android-apps-state-writer.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';

@Module({
  imports: [AndroidAppsPersistenceModule, DockerModule, NetworkPolicyModule],
  providers: [
    AndroidAppsLogService,
    AndroidAppLifecycleJobsService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
  exports: [
    AndroidAppsLogService,
    AndroidAppLifecycleJobsService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsQueryService,
    AndroidAppsRuntimeStateReconciler,
    AndroidAppsStateWriter,
    AndroidAppsStatusService,
  ],
})
export class AndroidAppsCommonModule {}

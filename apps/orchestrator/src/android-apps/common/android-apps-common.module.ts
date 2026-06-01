import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidApplication } from '../android-application.entity';
import { AndroidAppLifecycleJob } from '../lifecycle/entities/android-app-lifecycle-job.entity';
import { AndroidAppLifecycleJobsService } from '../lifecycle/services/android-app-lifecycle-jobs.service';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from './services/android-apps-state.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication, AndroidAppLifecycleJob]),
    DockerModule,
    NetworkPolicyModule,
  ],
  providers: [
    AndroidAppsLogService,
    AndroidAppLifecycleJobsService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsStateService,
    AndroidAppsStatusService,
  ],
  exports: [
    AndroidAppsLogService,
    AndroidAppLifecycleJobsService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsStateService,
    AndroidAppsStatusService,
  ],
})
export class AndroidAppsCommonModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidApplication } from '../android-application.entity';
import { AndroidAppsLogService } from './services/android-apps-log.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from './services/android-apps-state.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication]),
    DockerModule,
    NetworkPolicyModule,
  ],
  providers: [
    AndroidAppsLogService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsStateService,
    AndroidAppsStatusService,
  ],
  exports: [
    AndroidAppsLogService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsStateService,
    AndroidAppsStatusService,
  ],
})
export class AndroidAppsCommonModule {}

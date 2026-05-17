import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApkModule } from '../apk/apk.module';
import { DockerModule } from '../docker/docker.module';
import { NetworkIsolationModule } from '../network-isolation/network-isolation.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { SettingsModule } from '../settings/settings.module';
import { AndroidApplication } from './android-application.entity';
import { AndroidAppsController } from './android-apps.controller';
import { InactivityService } from './inactivity.service';
import { AndroidAppsService } from './android-apps.service';
import { AndroidAppsFacadeService } from './services/android-apps-facade.service';
import { AndroidAppsOperationsService } from './services/android-apps-operations.service';
import { AndroidAppsProvisioningService } from './services/android-apps-provisioning.service';
import { AndroidAppsProvisioningTrackerService } from './services/android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from './services/android-apps-state.service';
import { AndroidAppsStatusService } from './services/android-apps-status.service';

const androidAppsServiceProvider = {
  provide: AndroidAppsService,
  useExisting: AndroidAppsFacadeService,
};
@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication]),
    DockerModule,
    NetworkIsolationModule,
    NetworkPolicyModule,
    SettingsModule,
    ApkModule,
  ],
  controllers: [AndroidAppsController],
  providers: [
    AndroidAppsFacadeService,
    AndroidAppsOperationsService,
    androidAppsServiceProvider,
    AndroidAppsProvisioningService,
    AndroidAppsProvisioningTrackerService,
    AndroidAppsStateService,
    AndroidAppsStatusService,
    InactivityService,
  ],
  exports: [AndroidAppsService, AndroidAppsFacadeService],
})
export class AndroidAppsModule {}

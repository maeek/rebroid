import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AndroidAppsModule } from './android-apps/android-apps.module';
import { ApkModule } from './apk/apk.module';
import { ContainerImagesModule } from './container-images/container-images.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { DockerModule } from './docker/docker.module';
import { DockerMaintenanceModule } from './docker-maintenance/docker-maintenance.module';
import { HealthModule } from './health/health.module';
import { NetworkIsolationModule } from './network-isolation/network-isolation.module';
import { NetworkPolicyModule } from './network-policy/network-policy.module';
import { SecurityModule } from './security/security.module';
import { SettingsModule } from './settings/settings.module';
import { SystemResourcesModule } from './system-resources/system-resources.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    DockerModule,
    NetworkIsolationModule,
    NetworkPolicyModule,
    ApkModule,
    AndroidAppsModule,
    ContainerImagesModule,
    DockerMaintenanceModule,
    SettingsModule,
    SystemResourcesModule,
    HealthModule,
    SecurityModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AndroidAppsModule } from './android-apps/android-apps.module';
import { ContainerImagesModule } from './container-images/container-images.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { DockerModule } from './docker/docker.module';
import { DockerMaintenanceModule } from './docker-maintenance/docker-maintenance.module';
import { HealthModule } from './health/health.module';
import { NetworkIsolationModule } from './network-isolation/network-isolation.module';
import { ScrcpyModule } from './scrcpy/scrcpy.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    DockerModule,
    NetworkIsolationModule,
    AndroidAppsModule,
    ContainerImagesModule,
    DockerMaintenanceModule,
    ScrcpyModule,
    HealthModule,
  ],
})
export class AppModule {}

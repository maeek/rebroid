import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApkModule } from '../apk/apk.module';
import { DockerModule } from '../docker/docker.module';
import { NetworkIsolationModule } from '../network-isolation/network-isolation.module';
import { NetworkPolicyModule } from '../network-policy/network-policy.module';
import { SettingsModule } from '../settings/settings.module';
import { AndroidApplication } from './android-application.entity';
import { AndroidAppsController } from './android-apps.controller';
import { AndroidAppsService } from './android-apps.service';
import { InactivityService } from './inactivity.service';

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
  providers: [AndroidAppsService, InactivityService],
  exports: [AndroidAppsService],
})
export class AndroidAppsModule {}

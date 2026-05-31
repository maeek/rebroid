import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApkModule } from '../../apk/apk.module';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { SettingsModule } from '../../settings/settings.module';
import { AndroidApplication } from '../android-application.entity';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsLifecycleController } from './controllers/android-apps-lifecycle.controller';
import { AndroidAppsRuntimeNetworkModule } from '../network/android-apps-runtime-network.module';
import { AndroidAppsProvisioningModule } from '../provisioning/android-apps-provisioning.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsLifecycleService } from './services/android-apps-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AndroidApplication]),
    ApkModule,
    DockerModule,
    NetworkIsolationModule,
    NetworkPolicyModule,
    SettingsModule,
    AndroidAppsCommonModule,
    AndroidAppsRuntimeNetworkModule,
    AndroidAppsProvisioningModule,
    AndroidAppsViewerModule,
  ],
  controllers: [AndroidAppsLifecycleController],
  providers: [AndroidAppsLifecycleService],
  exports: [AndroidAppsLifecycleService],
})
export class AndroidAppsLifecycleModule {}

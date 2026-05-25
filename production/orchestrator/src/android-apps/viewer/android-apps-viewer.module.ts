import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { SettingsModule } from '../../settings/settings.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsViewerController } from './controllers/android-apps-viewer.controller';
import { AndroidAppsDisplaySidecarService } from './services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from './services/android-apps-sidecar-adb.service';
import { AndroidAppsViewerNetworkService } from './services/android-apps-viewer-network.service';
import { AndroidAppsViewerService } from './services/android-apps-viewer.service';

@Module({
  imports: [
    DockerModule,
    NetworkPolicyModule,
    SettingsModule,
    AndroidAppsCommonModule,
  ],
  controllers: [AndroidAppsViewerController],
  providers: [
    AndroidAppsViewerNetworkService,
    AndroidAppsDisplaySidecarService,
    AndroidAppsSidecarAdbService,
    AndroidAppsViewerService,
  ],
  exports: [
    AndroidAppsViewerNetworkService,
    AndroidAppsDisplaySidecarService,
    AndroidAppsSidecarAdbService,
    AndroidAppsViewerService,
  ],
})
export class AndroidAppsViewerModule {}

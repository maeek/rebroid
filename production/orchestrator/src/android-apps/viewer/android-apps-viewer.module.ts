import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { SettingsModule } from '../../settings/settings.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsViewerController } from './controllers/android-apps-viewer.controller';
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
  providers: [AndroidAppsViewerNetworkService, AndroidAppsViewerService],
  exports: [AndroidAppsViewerNetworkService, AndroidAppsViewerService],
})
export class AndroidAppsViewerModule {}

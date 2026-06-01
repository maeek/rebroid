import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsNetworkController } from './controllers/android-apps-network.controller';
import { AndroidAppsNetworkPolicyService } from './services/android-apps-network-policy.service';
import { AndroidAppsRuntimeNetworkService } from './services/android-apps-runtime-network.service';

@Module({
  imports: [
    DockerModule,
    NetworkIsolationModule,
    NetworkPolicyModule,
    AndroidAppsCommonModule,
    AndroidAppsViewerModule,
  ],
  controllers: [AndroidAppsNetworkController],
  providers: [
    AndroidAppsNetworkPolicyService,
    AndroidAppsRuntimeNetworkService,
  ],
  exports: [AndroidAppsNetworkPolicyService, AndroidAppsRuntimeNetworkService],
})
export class AndroidAppsRuntimeNetworkModule {}

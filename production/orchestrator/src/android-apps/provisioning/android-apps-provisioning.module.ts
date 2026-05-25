import { Module } from '@nestjs/common';
import { ApkModule } from '../../apk/apk.module';
import { DockerModule } from '../../docker/docker.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsRuntimeNetworkModule } from '../network/android-apps-runtime-network.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsProvisioningAndroidService } from './services/android-apps-provisioning-android.service';
import { AndroidAppsProvisioningApkService } from './services/android-apps-provisioning-apk.service';
import { AndroidAppsProvisioningService } from './services/android-apps-provisioning.service';

@Module({
  imports: [
    ApkModule,
    DockerModule,
    AndroidAppsCommonModule,
    AndroidAppsRuntimeNetworkModule,
    AndroidAppsViewerModule,
  ],
  providers: [
    AndroidAppsProvisioningAndroidService,
    AndroidAppsProvisioningApkService,
    AndroidAppsProvisioningService,
  ],
  exports: [
    AndroidAppsProvisioningAndroidService,
    AndroidAppsProvisioningApkService,
    AndroidAppsProvisioningService,
  ],
})
export class AndroidAppsProvisioningModule {}

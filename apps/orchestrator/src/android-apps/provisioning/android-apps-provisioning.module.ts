import { Module } from '@nestjs/common';
import { ApkModule } from '../../apk/apk.module';
import { AppConfigModule } from '../../config/app-config.module';
import { DockerModule } from '../../docker/docker.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsRuntimeNetworkModule } from '../network/android-apps-runtime-network.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsProvisioningAndroidService } from './services/android-apps-provisioning-android.service';
import { AndroidAppsApkInstallLifecycleService } from './services/android-apps-apk-install-lifecycle.service';
import { AndroidAppsProvisioningApkService } from './services/android-apps-provisioning-apk.service';
import { AndroidAppsProvisioningService } from './services/android-apps-provisioning.service';
import { AndroidAppsRuntimeActivationService } from './services/android-apps-runtime-activation.service';

@Module({
  imports: [
    ApkModule,
    AppConfigModule,
    DockerModule,
    AndroidAppsCommonModule,
    AndroidAppsRuntimeNetworkModule,
    AndroidAppsViewerModule,
  ],
  providers: [
    AndroidAppsProvisioningAndroidService,
    AndroidAppsApkInstallLifecycleService,
    AndroidAppsProvisioningApkService,
    AndroidAppsProvisioningService,
    AndroidAppsRuntimeActivationService,
  ],
  exports: [
    AndroidAppsProvisioningAndroidService,
    AndroidAppsApkInstallLifecycleService,
    AndroidAppsProvisioningApkService,
    AndroidAppsProvisioningService,
    AndroidAppsRuntimeActivationService,
  ],
})
export class AndroidAppsProvisioningModule {}

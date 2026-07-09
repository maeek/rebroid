import { Module } from '@nestjs/common';
import { AndroidAppsCommonModule } from './common/android-apps-common.module';
import { AndroidAppsController } from './common/controllers/android-apps.controller';
import { AndroidAppsFacadeService } from './common/services/android-apps-facade.service';
import { AndroidAppsService } from './common/android-apps.service';
import { InactivityService } from './common/services/inactivity.service';
import { AndroidAppsLifecycleModule } from './lifecycle/android-apps-lifecycle.module';
import { AndroidAppsRuntimeNetworkModule } from './network/android-apps-runtime-network.module';
import { AndroidAppsProvisioningModule } from './provisioning/android-apps-provisioning.module';
import { AndroidAppsRuntimeModule } from './runtime/android-apps-runtime.module';
import { AndroidAppsViewerModule } from './viewer/android-apps-viewer.module';
import { ANDROID_APPS_AUTOMATION } from './contracts/android-apps-automation.port';

const androidAppsServiceProvider = {
  provide: AndroidAppsService,
  useExisting: AndroidAppsFacadeService,
};
const androidAppsAutomationProvider = {
  provide: ANDROID_APPS_AUTOMATION,
  useExisting: AndroidAppsFacadeService,
};
@Module({
  imports: [
    AndroidAppsCommonModule,
    AndroidAppsViewerModule,
    AndroidAppsRuntimeNetworkModule,
    AndroidAppsProvisioningModule,
    AndroidAppsLifecycleModule,
    AndroidAppsRuntimeModule,
  ],
  controllers: [AndroidAppsController],
  providers: [
    AndroidAppsFacadeService,
    androidAppsServiceProvider,
    androidAppsAutomationProvider,
    InactivityService,
  ],
  exports: [
    AndroidAppsService,
    AndroidAppsFacadeService,
    ANDROID_APPS_AUTOMATION,
  ],
})
export class AndroidAppsModule {}

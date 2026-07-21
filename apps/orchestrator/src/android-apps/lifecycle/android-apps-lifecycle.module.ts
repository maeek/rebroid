import { Module } from '@nestjs/common';
import { ApkModule } from '../../apk/apk.module';
import { AppConfigModule } from '../../config/app-config.module';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { NetworkPolicyModule } from '../../network-policy/network-policy.module';
import { SettingsModule } from '../../settings/settings.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { AndroidAppsLifecycleController } from './controllers/android-apps-lifecycle.controller';
import { AndroidAppsRuntimeNetworkModule } from '../network/android-apps-runtime-network.module';
import { AndroidAppsProvisioningModule } from '../provisioning/android-apps-provisioning.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidApplicationFactory } from './services/android-application.factory';
import { AndroidAppsConfigurationService } from './services/android-apps-configuration.service';
import { AndroidAppsLifecycleRecoveryService } from './services/android-apps-lifecycle-recovery.service';
import { AndroidAppsLifecycleService } from './services/android-apps-lifecycle.service';
import { AndroidAppsPowerService } from './services/android-apps-power.service';
import { AndroidAppsRemovalCleanupService } from './services/android-apps-removal-cleanup.service';
import { AndroidAppsRemovalService } from './services/android-apps-removal.service';
import { AndroidAppsRuntimePreparationService } from './services/android-apps-runtime-preparation.service';
import { AndroidAppsStartLifecycleService } from './services/android-apps-start-lifecycle.service';
import { AndroidRuntimeImageResolverService } from './services/android-runtime-image-resolver.service';

@Module({
  imports: [
    AppConfigModule,
    AndroidAppsPersistenceModule,
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
  providers: [
    AndroidApplicationFactory,
    AndroidAppsConfigurationService,
    AndroidAppsLifecycleRecoveryService,
    AndroidAppsLifecycleService,
    AndroidAppsPowerService,
    AndroidAppsRemovalCleanupService,
    AndroidAppsRemovalService,
    AndroidAppsRuntimePreparationService,
    AndroidAppsStartLifecycleService,
    AndroidRuntimeImageResolverService,
  ],
  exports: [AndroidAppsLifecycleService],
})
export class AndroidAppsLifecycleModule {}

import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsRuntimeController } from './controllers/android-apps-runtime.controller';
import { AndroidAppsRuntimeAccessService } from './services/android-apps-runtime-access.service';
import { AndroidAppsRuntimeDeviceService } from './services/android-apps-runtime-device.service';
import { AndroidAppsRuntimeDiagnosticsService } from './services/android-apps-runtime-diagnostics.service';

@Module({
  imports: [
    DockerModule,
    NetworkIsolationModule,
    AndroidAppsCommonModule,
    AndroidAppsViewerModule,
  ],
  controllers: [AndroidAppsRuntimeController],
  providers: [
    AndroidAppsRuntimeAccessService,
    AndroidAppsRuntimeDeviceService,
    AndroidAppsRuntimeDiagnosticsService,
  ],
  exports: [AndroidAppsRuntimeAccessService],
})
export class AndroidAppsRuntimeModule {}

import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsRuntimeController } from './controllers/android-apps-runtime.controller';
import { AndroidAppsRuntimeAccessService } from './services/android-apps-runtime-access.service';
import { AndroidAppsRuntimeDeviceService } from './services/android-apps-runtime-device.service';
import { AndroidAppsRuntimeDiagnosticsService } from './services/android-apps-runtime-diagnostics.service';
import { RuntimeDataFilesService } from './services/runtime-data-files.service';
import { RuntimeDownloadFilesService } from './services/runtime-download-files.service';
import { RuntimeDownloadVolumeService } from './services/runtime-download-volume.service';
import { RuntimeFilePathService } from './services/runtime-file-path.service';
import { RuntimeUploadStreamService } from './services/runtime-upload-stream.service';

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
    RuntimeDataFilesService,
    RuntimeDownloadFilesService,
    RuntimeDownloadVolumeService,
    RuntimeFilePathService,
    RuntimeUploadStreamService,
  ],
  exports: [AndroidAppsRuntimeAccessService],
})
export class AndroidAppsRuntimeModule {}

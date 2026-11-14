import { Module } from '@nestjs/common';
import { DockerModule } from '../../docker/docker.module';
import { NetworkIsolationModule } from '../../network-isolation/network-isolation.module';
import { AndroidAppsCommonModule } from '../common/android-apps-common.module';
import { AndroidAppsPersistenceModule } from '../persistence/android-apps-persistence.module';
import { AndroidAppsViewerModule } from '../viewer/android-apps-viewer.module';
import { AndroidAppsRuntimeController } from './controllers/android-apps-runtime.controller';
import { AndroidAppsRuntimeSnapshotController } from './controllers/android-apps-runtime-snapshot.controller';
import { AndroidAppsRuntimeAccessService } from './services/android-apps-runtime-access.service';
import { AndroidAppsRuntimeDeviceService } from './services/android-apps-runtime-device.service';
import { AndroidAppsRuntimeDiagnosticsService } from './services/android-apps-runtime-diagnostics.service';
import { AndroidAppsRuntimeNotificationsService } from './services/android-apps-runtime-notifications.service';
import { AndroidAppsRuntimeSnapshotService } from './services/android-apps-runtime-snapshot.service';
import { RuntimeDataFilesService } from './services/runtime-data-files.service';
import { RuntimeDownloadFilesService } from './services/runtime-download-files.service';
import { RuntimeDownloadVolumeService } from './services/runtime-download-volume.service';
import { RuntimeFilePathService } from './services/runtime-file-path.service';
import { RuntimeFilePreviewService } from './services/runtime-file-preview.service';
import { RuntimeUploadStreamService } from './services/runtime-upload-stream.service';

@Module({
  imports: [
    DockerModule,
    NetworkIsolationModule,
    AndroidAppsCommonModule,
    AndroidAppsPersistenceModule,
    AndroidAppsViewerModule,
  ],
  controllers: [
    AndroidAppsRuntimeController,
    AndroidAppsRuntimeSnapshotController,
  ],
  providers: [
    AndroidAppsRuntimeAccessService,
    AndroidAppsRuntimeDeviceService,
    AndroidAppsRuntimeDiagnosticsService,
    AndroidAppsRuntimeNotificationsService,
    AndroidAppsRuntimeSnapshotService,
    RuntimeDataFilesService,
    RuntimeDownloadFilesService,
    RuntimeDownloadVolumeService,
    RuntimeFilePathService,
    RuntimeFilePreviewService,
    RuntimeUploadStreamService,
  ],
  exports: [AndroidAppsRuntimeAccessService],
})
export class AndroidAppsRuntimeModule {}

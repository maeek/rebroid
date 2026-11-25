import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { SettingsModule } from '../../settings/settings.module';
import { ExternalAndroidDevice } from './devices/external-android-device.entity';
import { ExternalAndroidDevicesController } from './devices/external-android-devices.controller';
import { ExternalAndroidDevicesService } from './devices/external-android-devices.service';
import { ExternalAdbBrokerClient } from './devices/external-adb-broker.client';
import { ExternalDeviceViewerController } from './devices/external-device-viewer.controller';
import { ExternalDeviceViewerService } from './devices/external-device-viewer.service';
import { ExternalAutomationDeviceService } from './devices/external-automation-device.service';
import { ExternalViewerAdministrationController } from './devices/external-viewer-administration.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalAndroidDevice]),
    FeatureFlagsModule,
    MetricsModule,
    SettingsModule,
  ],
  controllers: [
    ExternalViewerAdministrationController,
    ExternalAndroidDevicesController,
    ExternalDeviceViewerController,
  ],
  providers: [
    ExternalAndroidDevicesService,
    ExternalAdbBrokerClient,
    ExternalDeviceViewerService,
    ExternalAutomationDeviceService,
  ],
  exports: [ExternalAutomationDeviceService, ExternalAndroidDevicesService],
})
export class ExternalAndroidDevicesModule {}

import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { SettingsModule } from '../settings/settings.module';
import { OcrSidecarService } from './ocr-sidecar.service';

@Module({
  imports: [SettingsModule, FeatureFlagsModule],
  providers: [OcrSidecarService],
  exports: [OcrSidecarService],
})
export class OcrSidecarModule {}

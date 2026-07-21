import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SettingsModule } from '../settings/settings.module';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsGuard } from './feature-flags.guard';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  imports: [SettingsModule],
  controllers: [FeatureFlagsController],
  providers: [
    FeatureFlagsService,
    FeatureFlagsGuard,
    { provide: APP_GUARD, useExisting: FeatureFlagsGuard },
  ],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}

import { Module } from '@nestjs/common';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [
    AiProviderHealthService,
    AiProviderModelDownloadService,
    OrchestratorSettingsStore,
    SettingsService,
  ],
  exports: [SettingsService],
})
export class SettingsModule {}

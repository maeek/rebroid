import { Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { AutomationCommandsModule } from '../commands/automation-commands.module';
import { VisionAutomationCommandsService } from '../commands/vision-automation-commands.service';
import { AutomationEventsModule } from '../events/automation-events.module';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { AutomationAiActionExecutor } from './automation-ai-action-executor.service';
import { AutomationAiDecisionService } from './automation-ai-decision.service';
import { AutomationAiHarnessService } from './automation-ai-harness.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import { AutomationAiSuggestionsService } from './automation-ai-suggestions.service';
import { AutomationVisionCommandRegistrationService } from './automation-vision-command-registration.service';
import { AutomationOcrService } from '../vision/automation-ocr.service';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import { AutomationVisionService } from '../vision/automation-vision.service';
import { AutomationVisionCaptureService } from '../vision/automation-vision-capture.service';
import { AutomationVisionFusionService } from '../vision/automation-vision-fusion.service';
import { AutomationVisionModelService } from '../vision/automation-vision-model.service';
import { MetricsModule } from '../../metrics/metrics.module';
import { AUTOMATION_OCR } from '../vision/automation-ocr.port';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [
    SettingsModule,
    FeatureFlagsModule,
    MetricsModule,
    AutomationCommandsModule,
    AutomationEventsModule,
  ],
  providers: [
    AutomationAiChatClientService,
    AutomationAiActionExecutor,
    AutomationAiDecisionService,
    AutomationAiHarnessService,
    AutomationAiProviderService,
    AutomationAiSuggestionsService,
    AutomationOcrService,
    { provide: AUTOMATION_OCR, useExisting: AutomationOcrService },
    AutomationPerceptionService,
    AutomationVisionCaptureService,
    AutomationVisionFusionService,
    AutomationVisionModelService,
    AutomationVisionService,
    VisionAutomationCommandsService,
    AutomationVisionCommandRegistrationService,
  ],
  exports: [
    AutomationAiChatClientService,
    AutomationAiHarnessService,
    AutomationAiProviderService,
    AutomationAiSuggestionsService,
    AutomationVisionService,
  ],
})
export class AutomationAiModule {}

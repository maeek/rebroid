import { Module } from '@nestjs/common';
import { AndroidAppsCommonModule } from '../android-apps/common/android-apps-common.module';
import { AndroidAppsLifecycleModule } from '../android-apps/lifecycle/android-apps-lifecycle.module';
import { AndroidAppsRuntimeNetworkModule } from '../android-apps/network/android-apps-runtime-network.module';
import { AndroidAppsViewerModule } from '../android-apps/viewer/android-apps-viewer.module';
import { SettingsModule } from '../settings/settings.module';
import { AutomationAiHarnessService } from './ai/automation-ai-harness.service';
import { AutomationAiProviderService } from './ai/automation-ai-provider.service';
import { AndroidAutomationCommandsService } from './commands/android-automation-commands.service';
import { AiAutomationCommandsService } from './commands/ai-automation-commands.service';
import { AutomationCommandRegistryService } from './commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from './commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from './commands/generic-automation-commands.service';
import { VisionAutomationCommandsService } from './commands/vision-automation-commands.service';
import { AutomationConditionService } from './condition/automation-condition.service';
import { AutomationsController } from './controllers/automations.controller';
import { AutomationDefinitionService } from './definition/automation-definition.service';
import { AutomationRunEventBus } from './events/automation-run-event-bus.service';
import { AutomationRunEventStreamService } from './events/automation-run-event-stream.service';
import { AutomationsPersistenceModule } from './persistence/automations-persistence.module';
import { AutomationRunnerRecorderService } from './runner/automation-runner-recorder.service';
import { AutomationRunnerService } from './runner/automation-runner.service';
import { AutomationCronRegistryService } from './scheduler/automation-cron-registry.service';
import { AutomationScheduleService } from './scheduler/automation-schedule.service';
import { AutomationsDtoMapper } from './services/automations-dto-mapper.service';
import { AutomationsService } from './services/automations.service';
import { AutomationTriggerSchedulerService } from './services/automation-trigger-scheduler.service';
import { AutomationPerceptionService } from './vision/automation-perception.service';
import { AutomationVisionService } from './vision/automation-vision.service';

@Module({
  imports: [
    AutomationsPersistenceModule,
    AndroidAppsCommonModule,
    AndroidAppsLifecycleModule,
    AndroidAppsViewerModule,
    AndroidAppsRuntimeNetworkModule,
    SettingsModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AndroidAutomationCommandsService,
    AiAutomationCommandsService,
    VisionAutomationCommandsService,
    ContainerNetworkAutomationCommandsService,
    GenericAutomationCommandsService,
    AutomationAiProviderService,
    AutomationAiHarnessService,
    AutomationVisionService,
    AutomationPerceptionService,
    AutomationRunEventBus,
    AutomationRunEventStreamService,
    AutomationCommandRegistryService,
    AutomationConditionService,
    AutomationDefinitionService,
    AutomationRunnerRecorderService,
    AutomationRunnerService,
    AutomationCronRegistryService,
    AutomationScheduleService,
    AutomationsDtoMapper,
    AutomationTriggerSchedulerService,
    AutomationsService,
  ],
  exports: [AutomationRunEventStreamService],
})
export class AutomationsModule {}
